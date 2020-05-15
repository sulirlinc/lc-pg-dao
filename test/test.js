const dao = require('../src')
describe('pg数据库工具类', () => {
  const dao = dao({
    config: {
      "user": "postgres",
      "password": "123123",
      "host": "127.0.0.1",
      "port": "5432",
      "database": "test"
    }
  })
  it("1.初始化", (done) => {
    const { client } = dao
    client().then(data => {
      console.log("初始化完成。")
      console.log(`data:${ data }`)
      done()
    }).catch(e => console.error(e));
  }).timeout(120000)
  it("2.创建表", (done) => {
    dao.createTable({
      isAutoCreateId: true,
      idName : 'column_id',
      tableName: 't_u_column',
      isAutoCreateOperatorId: true,
      fields: [ {
        name: 'key',
        type: 'varchar',
        isNotNull: true
      }, {
        name: 'type',
        type: 'varchar',
        isNotNull: true
      }
      ], uniqueKeys: [ 'code,key' ]
    }).then((data) => {
      console.log(data)
      done()
    }).catch(e => {
      console.error(e)
      done()
    })
  })
  it("3.插入", (done) => {
    dao.insertData({
      tableName: 't_u_column',
      primaryKeys: { key: '123' },
      data: [ { key: '123' } ]
    }).then((data) => {
      console.log(data)
      done()
    }).catch(e => {
      console.error(e)
      done()
    })
    dao.insertData({
      tableName: 't_u_column',
      unCheck: true,
      data: [ { key: '123' } ]
    }).then((data) => {
      console.log(data)
      done()
    }).catch(e => {
      console.error(e)
      done()
    })
  })
})