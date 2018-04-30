const util = require('util');
const NewsApi = require("newsapi");
const newsapi = new NewsApi("1f62f144d9584aaeb3fb553f42c989a6");
const extractor = require("unfluff");
const axios = require("axios");
const knex = require("knex")({
    client: 'sqlite3',
    connection: { filename: "./mydb.sqlite" }
});

const NLUV1 = require("watson-developer-cloud/natural-language-understanding/v1.js");
const nlu = new NLUV1({
    'username': '5f6b8a01-3714-4fad-a78f-8a057310f8f2',
    'password': 'Sa33OCUMOpRR',
    'version': '2018-03-16'
});
const analyze = util.promisify(nlu.analyze);

run();

function createTable() {
    knex.schema.createTable('articles', function (table) {
        table.dateTime('date');
        table.string('url');
        table.string('title');
        table.string('text');
        table.string('topics');
        table.string('keywords');
        table.string('entities');
    });
}

function insert(data) {
    knex.insert(data).into('articles')
}

async function getTopHeadlines() {
    let headlines = await newsapi.v2.topHeadlines({
        language: 'en'
    });
    return headlines.articles;
}

async function getHtml(url) {
    //if(isUrl(url))
    return await axios(url);
}

async function getExtractedContent(html) {
    return extractor(html);
}

async function getNluData(entries) {
    return await Promise.all(entries.map(async (x) => {
        try {
            let params = {
                'text': x.text,
                'features': {
                    'entities': {
                        'emotion': true,
                        'sentiment': true,
                        'limit': 2
                    },
                    'keywords': {
                        'emotion': true,
                        'sentiment': true,
                        'limit': 2
                    }
                }
            }

            //let data = await analyze(params);

            return await new Promise((resolve, reject) => {
                nlu.analyze(params, function (err, response) {
                    if (err)
                        reject(err)
                    else
                        //resolve(response)
                        x.entities = response.entities
                        x.keywords = response.keywprds
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
        createTable();

        //get top headlines from newsapi
        let headlines = await getTopHeadlines();
        entries = headlines.map(x => {
            return {
                date: x.publishedAt,
                url: x.url,
                title: x.title,
                description: x.description,
                source: x.source.name
            }
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
            return x.text;
        })



        await getNluData(entries);

        //TODO: get topics/keywords/entities

        //insert data into sqlite db
        insert(entries);

    } catch (error) {
        console.log(error);
    }
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