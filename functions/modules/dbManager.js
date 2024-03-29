//ここに関数を移していく
let AWS = require('aws-sdk')
const axios = require('axios')
require('date-utils')

class DbManager{

  constructor() {
    this.dynamoClient = new AWS.DynamoDB.DocumentClient({region:process.env['REGION']})
  }

  /**
   * dynamoDBからuserを取得する
   *
   * @param string id
   */
   getUser(id){
    //既にuserが登録されているか確認
    let queryParams = {
      TableName: process.env['TABLE_NAME'],
      KeyConditionExpression: "#type = :type and begins_with (#id_date, :id)",
      ExpressionAttributeNames:{
        "#type": "type",
        "#id_date": "id_date"
      },
      ExpressionAttributeValues: {
        ":type": 'user',
        ":id": id + '_',
      }
    }

    return this.dynamoClient.query(queryParams).promise()
  }

  /**
   * dynamoDBからuserのリストを取得する
   */
  getUserList(){
    let queryParams = {
      TableName: process.env['TABLE_NAME'],
      KeyConditionExpression: "#type = :type",
      ExpressionAttributeNames:{
        "#type": "type",
      },
      ExpressionAttributeValues: {
        ":type": 'user',
      }
    }

    return this.dynamoClient.query(queryParams).promise()
  }

  /**
   * idからカウントデータを取得する
   *
   * @param string id
   */
  getCountData(id){
    let queryParams = {
      TableName: process.env['TABLE_NAME'],
      KeyConditionExpression: "#type = :type and begins_with (#id_date, :id)",
      ExpressionAttributeNames:{
        "#type": "type",
        "#id_date": "id_date"
      },
      ExpressionAttributeValues: {
        ":type": 'count',
        ":id": id + '_',
      }
    }

    return this.dynamoClient.query(queryParams).promise()
  }

  /**
   * ユーザーを登録する
   *
   * @param body
   */
  storeUser(body){
    //日本時間にする
    let dt = new Date(Date.now() + ((new Date().getTimezoneOffset() + (9 * 60)) * 60 * 1000));
    let now = dt.toFormat("YYYY-MM-DD-HH24-MI-SS")

    let putItem = {
      type:'user',
      id_date: body.id + '_',
      id: body.id,
      date: now,
      username:body.username,
      name:body.name,
      profile_image_url:body.profile_image_url.replace("_normal.", ".")
    }

    let putParams = {
      TableName: process.env['TABLE_NAME'],
      Item: putItem
    }

   return this.dynamoClient.put(putParams).promise()
  }

  /**
   * twitterのカウントデータをdynamoDBに保存する
   *
   * @param string id
   */
  async storeCountData(id){
    let apiResponse = await this.getUserDataFromTwitter(id)
    let twitterUserData = apiResponse.data.data

    // ユーザーデータが取得できなければ終了
    if(twitterUserData == undefined){
      console.log(id + 'がidのデータを取得できません')
      return
    }

    //put用のデータを作成する
    let dt = new Date(Date.now() + ((new Date().getTimezoneOffset() + (9 * 60)) * 60 * 1000));
    let now = dt.toFormat("YYYY-MM-DD-HH24-MI-SS")

    let putItem = {
      type:'count',
      id_date: twitterUserData.id + '_' + now,
      id: twitterUserData.id,
      date: now,
      username:twitterUserData.username,
      name:twitterUserData.name,
      public_metrics:twitterUserData.public_metrics,
      //オリジナルサイズの画像パスに変換する
      profile_image_url:twitterUserData.profile_image_url.replace("_normal.", "."),
      entities:twitterUserData.entities,
      url:twitterUserData.url,
      description:twitterUserData.description,
      created_at:twitterUserData.created_at,
    }

    let putParams = {
      TableName: process.env['TABLE_NAME'],
      Item: putItem
    }

    return this.dynamoClient.put(putParams).promise()
  }

  /**
   * twitterのユーザーデータを更新する
   *
   * @param string id
   */
  async storeUserData(id){
    let apiResponse = await this.getUserDataFromTwitter(id)
    let twitterUserData = apiResponse.data.data

    // ユーザーデータが取得できなければ終了
    if(twitterUserData == undefined){
      console.log(id + 'がidのデータを取得できません')
      return
    }

    //update用のデータを作成する
    var updateParams = {
      TableName: process.env['TABLE_NAME'],
      Key:{
          'type': 'user',
          'id_date': id + '_'
      },
      UpdateExpression: "set #username=:username, #name=:name, #profile_image_url=:profile_image_url, #description=:description",
      ExpressionAttributeNames:{
        "#username":"username",
        "#name":"name",
        "#profile_image_url":"profile_image_url",
        "#description":"description"
      },
      ExpressionAttributeValues:{
          ":username":twitterUserData.username,
          ":name":twitterUserData.name,
          ":profile_image_url":twitterUserData.profile_image_url.replace("_normal.", "."),
          ":description":twitterUserData.description,
      },
      ReturnValues:"UPDATED_NEW"
    }

    return this.dynamoClient.update(updateParams).promise()
  }

  /**
   * twitterAPIからユーザーデータを取得する
   *
   * @private
   * @param string id
   */
  getUserDataFromTwitter(id){
    let bearerToken = process.env['BEARER_TOKEN']

    const options =
    {
      headers: {
        'Content-Type': 'application/json',
        'charset': 'utf-8',
        'Authorization': 'Bearer ' + bearerToken,
      }
    }

    let url = 'https://api.twitter.com/2/users/' + id +'?user.fields=public_metrics,url,entities,description,profile_image_url,created_at'

    return axios.get(url, options)
  }

}

module.exports = DbManager
