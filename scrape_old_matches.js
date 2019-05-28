const puppeteer = require('puppeteer')
var fs = require("fs");

//Connection DB
var Connection = require('tedious').Connection;
var config = {
    userName: 'rrfxJEcWfF',
    password: 'wn76y6bKKd',
    server: 'remotemysql.com'
};
var connection = new Connection(config);
connection.on('connect', function(err) {
    // If no error, then good to proceed.  
    console.log("Connected");
});

const récupérerUrls = async browser => {
    let urls = []
    for (var pageIndex = 1; pageIndex < 29; pageIndex++)
        urls.push("http://www.betbot.soccer/?page=" + pageIndex + "&filter=true&period=month&method=betbot&likelihood=every&odds=safe")
    return urls
}

const récupérerDonnées = async(browser, url) => {
    const page = await browser.newPage()
        //Activer le logging à l'intérieur de page.evaluate
    page.on('console', consoleObj => console.log(consoleObj.text()));
    await page.goto(url)
    await page.waitFor('body')

    let résultat = page.evaluate(() => {
        let data = [];
        let match = "";

        Array.from(document.querySelectorAll('table tr')).forEach(function(element) {
            let titres = element.getElementsByTagName("b")

            if (titres.length != 0) {
                //Titre du match
                match = titres[0].innerHTML + " - " + titres[1].innerHTML

                //Ligue
                let ligue = titres[0].parentElement.parentElement.getElementsByTagName("h5")[0].innerHTML.substring(26)
                match += "," + ligue.substring(0, ligue.indexOf("<"))

                //Remonter à l'élément tr
                let probas = titres[0].parentElement.parentElement.getElementsByTagName("h4")

                //Cas par cas en fonction du nb de résultats
                if (probas.length == 3)
                    match += "," + probas[0].firstElementChild.innerHTML + "," + probas[1].firstElementChild.innerHTML + "," + probas[2].firstElementChild.innerHTML
                else
                    match += "," + probas[0].firstElementChild.innerHTML + ",null," + probas[1].firstElementChild.innerHTML
                data.push(match)
            }
        })
        return data
    })
    return résultat
}

const scrap = async() => {
    const browser = await puppeteer.launch({ headless: true })
    const urlList = await récupérerUrls(browser)

    let résultats = []

    //Tester toutes les urls
    for (var i = 0; i < urlList.length; i++) {
        console.log("Progression : " + i + "/" + urlList.length)
        const retour = await récupérerDonnées(browser, urlList[i])
        for (var j = 0; j < retour.length; j++)
            résultats.push(retour[j])
    }
    await browser.close()
    return résultats
}

scrap()
    .then(value => {
        console.log("--- RESULTATS ---")
        value.forEach(function(element) {
            console.log(element)
        })
    })