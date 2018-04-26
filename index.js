const NewsApi = require("newsapi");
const newsapi = new NewsApi('1f62f144d9584aaeb3fb553f42c989a6');

const extractor = require("unfluff");

const axios = require("axios");

run();

async function getTopHeadlines(){
    return await newsapi.v2.topHeadlines({
        language: 'en'
    });
}

async function getHtml(url){
    return await axios(url);
}

async function getExtractedContent(html){
    return extractor(html);
}

async function run(){
    try {
        let headlines = await getTopHeadlines();
        let htmls = headlines.map(async function(x){
            return await getHtml(x); 
        });
    } catch (error) {
        console.log(error);
    }
}





//module.exports.getTopHeadlines = getTopHeadlines;     
