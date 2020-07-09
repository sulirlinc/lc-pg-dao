const { L } = require("lc-js-common");
const Pool = require('pg-pool')
const pg = (async (args = {}) => {
  try {
    const { config } = args
    const client = await new Pool(config).connect();
    return { client, pg }
  } catch (error) {
    throw {
      code: "lc.pg.dao.database.connect.error",
      message: '数据库链接失败。',
      info: { args },
      error
    }
  }
})

const doCheckNull = ({ value, codeName, info }) => {
  if (value) {
    return value
  } else if (codeName) {
    throw {
      info,
      code: codeName,
      error: new Error("业务无效。")
    }
  }
}

const checkPrimaryKeys = (primaryKeys) => {
  let isTrue = false
  for (const key in primaryKeys) {
    isTrue = !!primaryKeys[key]
    break
  }
  if (!isTrue) {
    throw {
      info: { primaryKeys },
      code: "lc.pg.dao.not.found.primary.keys",
      error: new Error("未找到主键。")
    }
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

const getBySet = (data) => {
  let values = "", queryConfig = [], index = 0
  for (const key in data) {
    values += `,${ L.toDBField(key) }=$${ (++index) } `
    queryConfig.push(data[key])
  }
  return { values: values.substr(1), queryConfig }
}

const getByWhere = (data, initIndex) => {
  let where = "", queryConfig = [], index = initIndex || 0
  for (const key in data) {
    where += `and ${ L.toDBField(key) }=$${ (++index) } `
    queryConfig.push(data[key])
  }
  return {
    where: where.length > 3 ? `where ${ where.substr(3) }` : '',
    queryConfig
  }
}

const putAdd = (where, index) => {
  return index === 1 ? where : `${ where } and`
}

const buildFields = ({ fields, primaryKey }) => {
  let str = ''
  fields.map(value => {
    let name = L.toDBField(value.name);
    str = `${ str } "${ name }" ${ value.type } ${ (value.default === null
        || value.default === undefined) ? ''
        : ` default ${ value.default }` } ${ value.isNotNull ? 'not null' : '' }`
    if (primaryKey === name) {
      str = `${ str } constraint table_name_pk primary key`
    }
    str = `${ str },`
  })
  if (L.isNullOrEmpty(str)) {
    throw {
      info: { fields, primaryKey },
      code: "lc.pg.dao.build.fields.data.is.null",
      error: new Error(`fields is null? ${ JSON.stringify(fields) }`)
    }
  }
  return `${ str }`
}

const dao = (({ c, config }) => {
  let client = c
  let datasource = null
  return {
    config,
    dao,
    async createTable({ fields = [], tableName, primaryKey, uniqueKeys = [], isAutoCreateId, isAutoCreateOperatorId, createUpdateAt, idName }) {
      tableName = L.toDBField(tableName)
      primaryKey = L.toDBField(primaryKey)
      const client = await this.client()
      let sql = ``
      try {
        sql = `create table if not exists ${ tableName } ( ${ isAutoCreateId
            ? ` ${idName || 'id'} bigserial not null ${ L.isNullOrEmpty(primaryKey)
                ? `constraint ${ tableName }_pk_id primary key` : '' },` : '' }`
        let column = buildFields({ fields, primaryKey })
        sql = `${ sql } ${ column } ${ isAutoCreateOperatorId
            ? `operator_id bigint not null,`
            : '' } create_at integer not null ${ createUpdateAt === false ? '' : ',update_at integer' }`
        uniqueKeys.map(value => {
          value = L.toDBField(value)
          sql = `${ sql } ${ !L.isNullOrEmpty(value)
              ? `,constraint ${ tableName }_pk_${ value.replace(
                  /\,/g, '_') } unique (${ value })` : '' }`
        });
        sql = `${ sql })`
        return (await client.query({ sql }));
      } catch (error) {
        throw {
          info: { fields, tableName, primaryKey, uniqueKeys, isAutoCreateId, isAutoCreateOperatorId, createUpdateAt },
          code: "lc.pg.dao.create.table.invalid.configuration",
          message: `创建表出错${ sql }`,
          error
        }
      }
    },

    async findByPagination({ tableName, data }) {
      const { startAt, endAt, limit = 10, offset = 0, ...conditions } = data || {}
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
                sql: `select * from ${ tableName } ${ where } order by create_at desc LIMIT $${ length + 1 } OFFSET $${ length + 2 }`,
                queryConfig: queryConfig.concat([ limit, offset ])
              }
          )
      ).rows;
      return { rows, count: await this.count({ client, tableName, where, queryConfig }) };
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

    async findByWhere({ tableName, data, codeName }) {
      tableName = L.toDBField(tableName)
      const { where, queryConfig } = getByWhere(data)
      const sql = `select * from ${ tableName } ${ where }`
      const object = (await (await this.client()).query({
        sql, queryConfig
      }))
      const rows = object.rowCount > 0 ? object.rows : null;
      return doCheckNull({ value: rows, codeName, info: { tableName, data } });
    },

    async findByCode({ tableName, data, codeName }) {
      tableName = L.toDBField(tableName)
      const { keys, queryConfig, argsIndex } = getByData(data)
      const sql = `select * from ${ tableName } where ${ keys }=${ argsIndex }`
      const object = (await (await this.client()).query({
        sql, queryConfig
      }))
      const rows = object.rowCount > 0 ? object.rows : null;
      return doCheckNull({ value: rows, codeName, info: { tableName, data } });
    },

    async update({ tableName, primaryKeys, data }) {
      tableName = L.toDBField(tableName)
      checkPrimaryKeys(primaryKeys)
      const client = await this.client()
      if (!await this.count({ client, tableName, ...getByWhere(primaryKeys) })) {
        throw {
          code: "lc.pg.dao.data.update.where.clause.not.found",
          info: { tableName, primaryKeys, data },
          error: new Error("更新数据的条件不存在。")
        }
      }
      const sets = getBySet(data)
      const { where, queryConfig } = getByWhere(data, sets.queryConfig.length - 1)
      const sql = `update ${ tableName } ${ sets.values } set ${ where })`
      return (await client.query({
        sql, queryConfig: sets.queryConfig.concat(queryConfig)
      })).rowCount
    },

    async insertData({ tableName, primaryKeys, data, unCheck }) {
      tableName = L.toDBField(tableName)
      if (!unCheck) {
        checkPrimaryKeys(primaryKeys)
      }
      const client = await this.client()
      if (!unCheck && await this.count({ client, tableName, ...getByWhere(primaryKeys) }) > 0) {
        throw {
          code: "lc.pg.dao.data.is.exists",
          info: { tableName, primaryKeys, data, unCheck },
          error: new Error("数据已存在")
        }
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

    async client() {
      datasource = datasource || (await pg({ config }))
      client = client || datasource.client
      if (!client.myOverviewQuery) {
        client.myOverviewQuery = client.query
        client.query = async ({ sql, queryConfig }) => {
          try {
            const object = (await client.myOverviewQuery(sql, queryConfig))
            return {
              ...object, rows: object.rows.map((value) => {
                const data = {}
                for (const key in value) {
                  data[L.toLittleHump(key)] = value[key]
                }
                return data
              })
            }
          } catch (error) {
            throw {
              info: { sql, queryConfig },
              code: "lc.pg.dao.execute.sql.error",
              error
            }
          }
        }
      }
      return client
    },
    async createDataBase({ name }) {
      const client = await this.client()
      return (await client.query({ sql: `create database ${ name }` }));
    }
  }
})
module.exports = dao
