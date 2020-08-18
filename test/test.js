describe('pg数据库工具类', () => {
  const dao = require('../src')({
    config: {
      "user": "postgres",
      "password": "123123",
      "host": "127.0.0.1",
      "port": "5432",
      "database": "test"
    }
  })
  dao.client().then(data => {
    console.log("初始化完成。")
    console.log(`data:${ JSON.stringify(data) }`)
  }).catch(e => console.error(e));
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
      idName: 'column_id',
      tableName: 't_u_column66',
      isAutoCreateOperatorId: true,
      fields: [ {
        name: 'key',
        type: 'varchar',
        isNotNull: true
      }, {
        name: 'type',
        type: 'varchar',
        isNotNull: true
      }, {
        name: 'code',
        type: 'varchar',
        isNotNull: true
      }
      ], uniqueKeys: [ 'code', 'key' ]
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
  it("4.查询数据", (done) => {
    dao.findByCode({
      tableName: 't_config_url',
      data: { code: 123 },
      codeName: 'code'
    }).then((data) => {
      console.log(data)
      done()
    }).catch(e => {
      console.error(e)
      done()
    })
    // 返回条数
    dao.count({
      tableName: 't_config_url',
      data: { code: 123 }
    }).then((data) => {
      console.log(data)
      done()
    }).catch(e => {
      console.error(e)
      done()
    })
    //根据Code 查询
  })
  it("5.批量插入", (done) => {
    console.log(
        [ "c:\\video2\\wyd-100\\wyd01.jpg", "c:\\video2\\wf-99\\wf01.jpg",
          "c:\\video2\\wf-132\\wf02.jpg" ].toString())

    dao.findByWhere({ tableName: "t_config_url", path: "c:\\" }).then(
        ({ value }) => {
          const { code, path, detailsMd5 } = value
          // 这里调用 getResult(path) 获取到 [{ full_path,create_at  }]
          const files = [
            {
              full_path: "c:\\video2\\wyd-100\\wyd01.jpg",
              create_at: 1594895327,
              md5: '123xxxx'
            },
            {
              file_path: "c:\\video2\\wf-99\\wf01.jpg",
              create_at: 1594895327,
              md5: '1234xxx'
            },
            {
              file_path: "c:\\video2\\wf-132\\wf02.jpg",
              create_at: 1594895327,
              md5: '12345xx'
            }
          ]
          //将获取到的上面的数据进行MD5
          const sign = md5(files.map(value => value.md5).toString())
          if (detailsMd5 === sign) {
            //这里表示文件夹中的所有内容和数据库中的文件是一致的，
            return
          }
          //  这里的代码，表示数据库中的MD5值和python返回的不一样

          /**
           * 假如这些是python返回的结果，你处理之后的明细表
           * { code: "84173D250EA1E4FD010FB6BF4596D0E6", name: "闻一多", frame: '100',
           *           videoSource: 'video2',
           *           filePath: "c:\\video2\\wyd-100\\wyd01.jpg",
           *           createAt: 1594895327
           * },
           */
          const items = getFormatData({ files, code })
          dao.deleteData({ tableName: "t_history", primaryKeys: { code } }) // 删除之前保存的数据。
          dao.insertItems({ tableName: "t_history", items })
          dao.update({
            tableName: "t_config_url",
            primaryKeys: { code },
            detailsMd5: sign
          }); // 最后：把python返回的上面的sign,更新到数据库的detailsMd5值。
        })
  })
  it("6.批量插入", (done) => {

    const checkDifferenceDocs = ({ code, path, detailsMd5, files }) => {
      const sign = md5(files.toString())
      if (sign === detailsMd5) {
        return true
      }
      dao.update({
        tableName: "t_config_url",
        primaryKeys: { code },
        detailsMd5: sign
      });
    }
    dao.findByWhere({ tableName: "t_config_url", path: "c:\\" }) // 假如扫描的结果路径是c盘
    .then(({ value }) => {
      const { code, path, detailsMd5 } = value
      if (!checkDifferenceDocs({
        path, // 肯定是 'c:\\',
        code, // 假如是"84173D250EA1E4FD010FB6BF4596D0E6",
        detailsMd5, // 假如是 E381E790FA81E99412616D420FAFCB66
        files: [
          "c:\\video2\\wyd-100\\wyd01.jpg",
          "c:\\video2\\wf-99\\wf01.jpg",
          "c:\\video2\\wf-132\\wf02.jpg"
        ], // 假如，这个根据path参数，请求python返回的结果。
      })) // 调用判断检查内容是否有差异？如果有，就更新下面内容，没有则跳过了
      {
        dao.insertItems({
          tableName: "t_history",
          items: [   //假如这些是python返回的结果，你处理之后的
            {
              code: "84173D250EA1E4FD010FB6BF4596D0E6",
              name: "闻一多",
              frame: '100',
              videoSource: 'video2',
              filePath: "c:\\video2\\wyd-100\\wyd01.jpg",
              createAt: 1594895327
            },
            {
              code: "84173D250EA1E4FD010FB6BF4596D0E6", name: "王菲", frame: '99',
              videoSource: 'video2',
              filePath: "c:\\video2\\wf-99\\wf01.jpg",
              createAt: 1594895327
            },
            {
              code: "84173D250EA1E4FD010FB6BF4596D0E6",
              name: "王菲",
              frame: '100',
              videoSource: 'video2',
              filePath: "c:\\video2\\wf-132\\wf02.jpg",
              createAt: 1594895327
            } ]
        }).then(data => console.log(data));
      }
    })
  })
})