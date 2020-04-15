# lc-pg-dao
postgres 数据库操作类。

## 使用方法

例如：

```javascript
const dao = require('lc-pg-dao')
const { assert } = require('chai');

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
    }).create({
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
```

更多事例与覆盖请查看单元测试``test\test.js``