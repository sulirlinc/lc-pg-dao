const dao = require('../src')
describe('pg数据库工具类', () => {
  it("1.初始化", (done) => {
    const { client } = dao({
      config: {
        "user": "postgres",
        "password": "123123",
        "host": "127.0.0.1",
        "port": "5432",
        "database": "test"
      }
    })
    client().then(data => {
      console.log("初始化完成。")
      done()
    }).catch(e => console.error(e));
  }).timeout(120000)
  it("2.创建表", (done) => {
    dao({
      config: {
        "user": "postgres",
        "password": "123123",
        "host": "127.0.0.1",
        "port": "5432",
        "database": "test"
      }
    }).createTable({
      isAutoCreateId: true,
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

})