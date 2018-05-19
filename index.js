const util = require('util');
const fs = require('fs');
const NewsApi = require("newsapi");
const newsapi = new NewsApi("1f62f144d9584aaeb3fb553f42c989a6");
const extractor = require("unfluff");
const axios = require("axios");
const knex = require("knex")({
    client: 'sqlite3',
    connection: { filename: "./mydb.sqlite" },
    useNullAsDefault: true
});

const NLUV1 = require("watson-developer-cloud/natural-language-understanding/v1.js");
const nlu = new NLUV1({
    'username': '5f6b8a01-3714-4fad-a78f-8a057310f8f2',
    'password': 'Sa33OCUMOpRR',
    'version': '2018-03-16'
});
const analyze = util.promisify(nlu.analyze);

run();

async function createTable() {
    await knex.schema.createTable('articles', function (table) {
        table.increments('id');
        table.dateTime('date');
        table.string('url');
        table.string('title');
        table.string('text');
        table.string('description');
        table.string('source');
        table.string('concepts');
        table.string('keywords');
        table.string('entities');
    });
}

function insert(data) {
    return knex('articles').insert(data);
}

function getTopHeadlines() {
    return newsapi.v2.topHeadlines({
        language: 'en'
        ,sources: 'google-news,bloomberg,cnn,the-washington-post,vice-news,bbc-news,bloomberg,fox-news,techcrunch,techradar',
        pageSize: 40
        //,category: 'technology,politics'
    });
}

function urlInDb(url){
    return knex('articles').where({url: url});
}

function getHtml(url) {
    return axios(url);
}

function getExtractedContent(html) {
    return extractor(html);
}

async function getNluData(entries) {
    return await Promise.all(entries.map(async (x) => {
        try {
            let params = {
                'text': x.text,
                'features': {
                    'entities': {'limit': 5},
                    'keywords': {'limit': 5},
                    'concepts': {'limit': 5}
                }
            }

            return await new Promise((resolve, reject) => {
                nlu.analyze(params, function (err, response) {
                    if (err)
                        reject(err)
                    else
                        x.entities = JSON.stringify(response.entities)
                        x.keywords = JSON.stringify(response.keywords)
                        x.concepts = JSON.stringify(response.concepts)
                        resolve(x);
                });
            });
        } catch (error) {
            console.log(error);
        }
    }));
}

async function run() {
    let entries = [];

    try {
        //create sqlite table if it doesnt exist
        //await createTable();

        //get top headlines from newsapi
        let headlines = await getTopHeadlines();

        entries = headlines.articles.map(x => {
            return {
                date: new Date(x.publishedAt),
                url: x.url,
                title: x.title,
                description: x.description,
                source: x.source.name
            }
        });

        let rows = await Promise.all(entries.map(x => {
            return urlInDb(x.url).then(y => {
                if(y.length <= 0){
                    return x;
                }
            });
        }));

        entries = rows.filter(x => {
            return x;
        });

        //get html page from headline urls
        entries = await Promise.all(entries.map(async function (x) {
            let html = await getHtml(x.url);
            let data = await getExtractedContent(html.data);
            if (data.text && data.text != "") {
                x.text = data.text;
                return x;
            }
        }));

       entries = entries.filter(x => {
            return x;
        });

        entries = await getNluData(entries);

        //insert data into sqlite db
        if (entries.length > 0 ){
            await insert(entries);
        }
        console.log('done');
        fs.writeFileSync("log.txt", new Date());
        
    } catch (error) {
        console.log(error);
    }
    
    process.exit();        
}

/**
 * @description determines if a given string is in url format or not
 * @param {String} s string to test for url format
 * @returns {Boolean} true if string is url format
 */
function isUrl(s) {
    var regexp = /(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/
    return regexp.test(s);
}