const { L } = require("lc-js-common")
const Pool = require('pg-pool')
const mybatisMapper = require('mybatis-mapper')
const fs = require('fs')
const p = require('path')
const join = p.join
const pg = (async (args = {}) => {
  try {
    const { config } = args
    const client = await new Pool(config).connect();
    return { client, pg }
  } catch (error) {
    error.stack = `${ new Error(JSON.stringify({
      code: "lc.pg.dao.database.connect.error",
      info: { args },
      message: '数据库连接失败。'
    })).stack }\n${ error.stack }`
    throw error
  }
})

const doCheckNull = ({ value, errorCodeName, info }) => {
  if (value) {
    return value
  } else if (errorCodeName) {
    throw new Error(`未找到主键。\n ${ JSON.stringify({
      info,
      code: errorCodeName
    }) }`)
  }
}

const checkPrimaryKeys = (primaryKeys) => {
  let isTrue = false
  for (const key in primaryKeys) {
    isTrue = !!primaryKeys[key]
    break
  }
  if (!isTrue) {
    throw new Error(`未找到主键。\n ${ JSON.stringify({
      info: { primaryKeys },
      code: "lc.pg.dao.not.found.primary.keys"
    }) }`)
  }
  return primaryKeys
}

const getByData = (data) => {
  let keys = "", queryConfig = [], argsIndex = "", index = 0
  for (const key in data) {
    keys += `,"${ L.toDBField(key) }"`
    queryConfig.push(data[key])
    argsIndex += ",$" + (++index)
  }
  return { keys: keys.substr(1), queryConfig, argsIndex: argsIndex.substr(1) }
}

const getBySet = (data, initIndex) => {
  let values = "", queryConfig = [], index = initIndex || 0
  for (const key in data) {
    values += `,${ L.toDBField(key) }=$${ (++index) } `
    queryConfig.push(data[key])
  }
  return { values: `set ${ values.substr(1) }`, queryConfig, index }
}

const getByWhere = (data, initIndex) => {
  let where = "", queryConfig = [], index = initIndex || 0
  for (const key in data) {
    const value = data[key]
    if (!(typeof value == "undefined" || value == null)) {
      where += `and ${ L.toDBField(key) }=$${ (++index) } `
      queryConfig.push(value)
    }
  }
  return {
    where: where.length > 3 ? `where ${ where.substr(3) }` : '', index,
    queryConfig
  }
}

const putAdd = (where, index) => {
  return index === 1 ? where : `${ where } and`
}

const buildFields = ({ fields, primaryKey, tableName }) => {
  let str = ''
  fields.map(value => {
    let name = L.toDBField(value.name);
    str = `${ str } "${ name }" ${ value.type } ${ (value.default === null
        || value.default === undefined) ? ''
        : ` default ${ value.default }` } ${ value.isNotNull ? 'not null'
        : '' }`
    if (primaryKey === name) {
      str = `${ str } constraint ${ tableName }_pk_${ primaryKey } primary key `
    }
    str = `${ str },`
  })
  if (L.isNullOrEmpty(str)) {
    throw new Error(
        `fields is null? ${ JSON.stringify(fields) } \n ${ JSON.stringify({
          info: { fields, primaryKey },
          code: "lc.pg.dao.build.fields.data.is.null"
        }) }`)
  }
  return `${ str }`
}

const findSync = (startPath) => {
  let result = [];

  function finder(path) {
    fs.readdirSync(path).forEach((val, index) => {
      let fPath = join(path, val);
      let stats = fs.statSync(fPath);
      if (stats.isDirectory()) {
        result.push(fPath);
        finder(fPath)
      }
      if (stats.isFile() && fPath.substring(fPath.length - 3) === 'xml') {
        result.push(fPath);
      }
    });
  }

  finder(startPath);
  return result;
}
const dao = (({ c, config, isLittleHump = true }) => {
  return {
    dClient: c,
    datasource: null,
    config,
    dao,
    isLittleHump,
    release() {
      delete this.dClient
      delete this.datasource
    },
    async createTable({ fields = [], tableName, primaryKey, uniqueKeys = [], isAutoCreateId, isAutoCreateOperatorId, createUpdateAt, idName }) {
      tableName = L.toDBField(tableName)
      primaryKey = L.toDBField(primaryKey)
      idName = L.toDBField(idName)
      const client = await this.client()
      let sql = ``
      try {
        sql = `create table if not exists ${ tableName } ( ${ isAutoCreateId
            ? ` ${ idName || 'id' } bigserial not null ${ L.isNullOrEmpty(
                primaryKey)
                ? `constraint ${ tableName }_pk_id primary key` : '' },` : '' }`
        let column = buildFields({ fields, primaryKey, tableName })
        sql = `${ sql } ${ column } ${ isAutoCreateOperatorId
            ? `operator_id bigint not null,`
            : '' } create_at integer not null ${ createUpdateAt === false ? ''
            : ',update_at integer' }`

        if (uniqueKeys.length > 0) {
          const mapUnique = uniqueKeys.map(
              value => L.toDBField(value)).toString();
          sql = `${ sql }, constraint ${ tableName }_${ L.toReplace(
              mapUnique, /[,]/g,
              () => "_") }_pk unique (${ mapUnique })`
        }
        sql = `${ sql })`
        return (await client.query({ sql }));
      } catch (error) {
        error.stack = `${ new Error(JSON.stringify(
            {
              info: {
                fields,
                tableName,
                primaryKey,
                uniqueKeys,
                isAutoCreateId,
                isAutoCreateOperatorId,
                createUpdateAt
              },
              code: "lc.pg.dao.create.table.invalid.configuration",
              message: `创建表出错${ sql }`
            }
        )).stack }\n${ error.stack }`
        throw error
      }
    },

    async findByPagination({ tableName, columns = [ '*' ], data, orderBy }) {
      const { startAt, endAt, limit = 10, offset = 0, ...conditions } = data
      || {}
      const client = await this.client()
      tableName = L.toDBField(tableName)
      let { where, queryConfig } = getByWhere(conditions)
      if (!L.isNullOrEmpty(startAt)) {
        queryConfig.push(startAt)
        const index = queryConfig.length
        where = putAdd(where);
        where = `${ where } create_at >= $${ index }`
      }
      if (!L.isNullOrEmpty(endAt)) {
        queryConfig.push(endAt)
        where = putAdd(where);
        const index = queryConfig.length
        where = `${ where } create_at < $${ index }`
      }
      const length = queryConfig.length;
      const rows = (await client.query({
                sql: `select ${ columns.map(value => L.toDBField(value)).toString() } from ${ tableName } ${ where }
                order by ${ orderBy ? orderBy : 'create_at desc ' }
                LIMIT $${ length
                + 1 } OFFSET $${ length + 2 }`,
                queryConfig: queryConfig.concat([ limit, offset ])
              }
          )
      ).rows;
      return {
        rows,
        count: await this.count({ client, tableName, where, queryConfig })
      };
    },
    async count({ client, tableName, where, data, queryConfig }) {
      client = client || await this.client();
      if (data) {
        const byWhere = getByWhere(data);
        where = byWhere.where;
        queryConfig = byWhere.queryConfig;
      }
      tableName = L.toDBField(tableName)
      return parseInt(
          (await client.query({
            sql: `select count(1) c from ${ tableName } ${ where }`,
            queryConfig
          })).rows[0].c
      );
    },

    async findByWhere({ tableName, columns = ['*'], data, errorCodeName, orderBy }) {
      tableName = L.toDBField(tableName)
      const { where, queryConfig } = getByWhere(data)
      const sql = `select ${ columns.map(value => L.toDBField(value)).toString() } from ${ tableName } ${ where } 
                ${ orderBy ? ` order by ${orderBy}` : '' }`
      const object = (await (await this.client()).query({
        sql, queryConfig
      }))
      const rows = object.rowCount > 0 ? object.rows : null;
      return doCheckNull(
          { value: rows, errorCodeName, info: { tableName, data } });
    },

    async findByCode({ tableName, data, columns = ['*'], errorCodeName, orderBy }) {
      tableName = L.toDBField(tableName)
      const { keys, queryConfig, argsIndex } = getByData(data)
      const sql = `select ${ columns.map(value => L.toDBField(value)).toString() } from ${ tableName } where ${ keys }=${ argsIndex } ${ orderBy ? ` order by ${orderBy}` : '' } `
      const object = (await (await this.client()).query({
        sql, queryConfig
      }))
      const rows = object.rowCount > 0 ? object.rows : null;
      return doCheckNull(
          { value: rows, errorCodeName, info: { tableName, data } });
    },

    async update({ tableName, primaryKeys, data }) {
      tableName = L.toDBField(tableName)
      checkPrimaryKeys(primaryKeys)
      const client = await this.client()
      if (!await this.count(
          { client, tableName, ...getByWhere(primaryKeys) })) {
        throw new Error(`更新数据的条件不存在。\n ${ JSON.stringify({
          code: "lc.pg.dao.data.update.where.clause.not.found",
          info: { tableName, primaryKeys, data }
        }) }`)
      }
      const sets = getBySet(data)
      const { where, queryConfig } = getByWhere(primaryKeys, sets.index)
      const sql = `update ${ tableName } ${ sets.values } ${ where }`
      return (await client.query({
        sql, queryConfig: sets.queryConfig.concat(queryConfig)
      })).rowCount
    },

    async insertItems({ tableName, items }) {
      tableName = L.toDBField(tableName)
      const client = await this.client()
      let sql = ''
      items.map(data => {
        const { keys, queryConfig, argsIndex } = getByData(data)
        if (sql === '') {
          sql = `insert into ${ tableName } (${ keys }) values `
        }
        sql += `(`
        queryConfig.map(value => sql += `${ value ? `'${ value }'` : value },`)
        sql = `${ sql.substring(0, sql.length - 1) }),`
      })
      sql = `${ sql.substring(0, sql.length - 1) }`
      return (await client.query({
        sql, queryConfig: []
      })).rowCount
    },

    /**
     * 存在更新，不存在插入
     * @param tableName
     * @param primaryKeys
     * @param data
     * @returns {Promise<*>}
     */
    async replaceData({ tableName, primaryKeys, data }) {
      checkPrimaryKeys(primaryKeys)
      tableName = L.toDBField(tableName)
      const client = await this.client()
      if (await this.count({ client, tableName, ...getByWhere(primaryKeys) })
          > 0) {
        return this.update({ tableName, primaryKeys, data })
      }
      const { keys, queryConfig, argsIndex } = getByData(data)
      const sql = `insert into ${ tableName } (${ keys }) values (${ argsIndex })`
      return (await (client).query({
        sql, queryConfig
      })).rowCount
    },
    async insertData({ tableName, primaryKeys, data, unCheck }) {
      tableName = L.toDBField(tableName)
      if (!unCheck) {
        checkPrimaryKeys(primaryKeys)
      }
      const client = await this.client()
      if (!unCheck && await this.count(
          { client, tableName, ...getByWhere(primaryKeys) }) > 0) {
        throw new Error(`数据已存在。\n ${ JSON.stringify({
          code: "lc.pg.dao.data.is.exists",
          info: { tableName, primaryKeys, data, unCheck }
        }) }`)
      }
      const { keys, queryConfig, argsIndex } = getByData(data)
      const sql = `insert into ${ tableName } (${ keys }) values (${ argsIndex })`
      return (await (client).query({
        sql, queryConfig
      })).rowCount
    },

    async deleteData({ tableName, primaryKeys }) {
      tableName = L.toDBField(tableName)
      checkPrimaryKeys(primaryKeys)
      const client = await this.client()
      const { where, queryConfig } = getByWhere(primaryKeys)
      return (await client.query({
        sql: `delete from ${ tableName } ${ where }`, queryConfig
      })).rowCount
    },
    mapper({ xmlFilePaths }) {
      const self = this
      mybatisMapper.createMapper(findSync(xmlFilePaths));
      const format = { language: 'sql', indent: '  ' };
      return {
        async query(namespace, selectId, param) {
          const client = await self.client()
          const sql = mybatisMapper.getStatement(namespace, selectId, param,
              format);
          return (await client.query({ sql })
          ).rows;
        }
      }
    },
    async client() {
      const self = this
      self.datasource = self.datasource || (await pg({ config }))
      self.dClient = self.dClient || self.datasource.client
      if (!self.dClient.myOverviewQuery) {
        self.dClient.myOverviewQuery = self.dClient.query
        self.dClient.query = async ({ sql, queryConfig }) => {
          try {
            const object = (await (self.dClient.myOverviewQuery(sql,
                queryConfig)))
            return {
              ...object, rows: self.isLittleHump ? object.rows.map((value) => {
                const data = {}
                for (const key in value) {
                  data[L.toLittleHump(key)] = value[key]
                }
                return data
              }) : object.rows
            }
          } catch (error) {
            if ("57P01" === error.code || L.isNullOrEmpty(error.code)) {
              self.release()
            }
            error.stack = `${ new Error(JSON.stringify({
              info: { sql, queryConfig },
              code: "lc.pg.dao.execute.sql.error",
            })).stack }\n${ error.stack }`
            throw error
          }
        }
      }
      return self.dClient
    },
    async createDataBase({ name }) {
      const client = await this.client()
      return (await client.query({ sql: `create database ${ name }` }));
    }
  }
})
module.exports = dao
