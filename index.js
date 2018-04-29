const NewsApi = require("newsapi");
const newsapi = new NewsApi("1f62f144d9584aaeb3fb553f42c989a6");
const extractor = require("unfluff");
const axios = require("axios");
const knex = require("knex")({
    client: 'sqlite3',
    connection: { filename: "./mydb.sqlite" }
})

run();

function createTable(){
    knex.schema.createTable('articles', function(table){
        table.dateTime('date');
        table.string('url');
        table.string('title');
        table.string('text');
        table.string('topics');
        table.string('keywords');
        table.string('entities');
    });
}

function insert(data){
    knex.insert(data).into('articles')
}

async function getTopHeadlines(){
    return await newsapi.v2.topHeadlines({
        language: 'en'
    });
}

async function getHtml(url){
    if(isUrl(url)) return await axios(url);
}

async function getExtractedContent(html){
    return extractor(html);
}

async function run(){
    let entries = [];

    try {
        //create sqlite table if it doesnt exist
        createTable();

        //get top headlines from newsapi
        let headlines = await getTopHeadlines();
        headlines.articles.map(x => {
            let entry = {}
            entry.date = x.date;
            entry.url = x.url;
            entry.title = x.title;
            entries.push(entry);
        });

        //get html page from headline urls
        let htmls = entries.map(async function(x){
            return await getHtml(x.url); 
        });

        //extract article content from html pages
        let texts = htmls.map(async function(x){
            return await getExtractedContent(x);
        });

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
function isUrl(s){
    var regexp = /(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/
    return regexp.test(s);
}