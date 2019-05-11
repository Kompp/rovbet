const puppeteer = require('puppeteer')

const récupérerUrls = async browser => {
    let urls = []
    for (var pageIndex = 1; pageIndex <= 3; pageIndex++)
        urls.push("http://www.betbot.soccer/?page=" + pageIndex + "&filter=true&period=upcoming&method=betbot&likelihood=every&odds=safe")
    return urls
}

const récupérerDonnées = async(browser, url) => {
    const page = await browser.newPage()
        //Activer le logging à l'intérieur de page.evaluate
    page.on('console', consoleObj => console.log(consoleObj.text()));
    await page.goto(url)
    await page.waitFor('body')

    let résultat = page.evaluate(() => {
        let matchs = []
        let vainqueurs = []
        let ligues = []
        let prédictions = []
        let dates = []

        //Recherche des éléments de la page
        Array.from(document.querySelectorAll('table tr')).forEach(function(element) {
            let titres = element.getElementsByTagName("b")

            if (titres.length != 0) {
                //Titre du match
                matchs.push(titres[0].innerHTML + " - " + titres[1].innerHTML)

                //Vainqueur
                if (titres[0].parentElement.parentElement.getElementsByTagName("h4")[0].textContent.includes("Win"))
                    vainqueurs.push(titres[0].innerHTML)
                else
                    vainqueurs.push(titres[1].innerHTML)

                //Ligue
                let ligue = titres[0].parentElement.parentElement.getElementsByTagName("h5")[0].innerHTML.substring(26)
                ligues.push(ligue.substring(0, ligue.indexOf("<")))
                    //Date
                let dateEl = titres[0].parentElement.parentElement.getElementsByTagName("h5")[0].innerHTML.substring(0, 10)
                dates.push(dateEl)

                //Remonter à l'élément tr
                let probas = titres[0].parentElement.parentElement.getElementsByTagName("h4")[0].parentElement
                    //Pourcentage de prédiction
                let probaSpan = probas.getAttribute("data-original-title")
                let pourcentage = probaSpan.substring(probaSpan.indexOf(".") + 1)

                if (pourcentage.length == 2)
                    prédictions.push(pourcentage.substring(0, 1) + "0%")
                else
                    prédictions.push(pourcentage)
            }
        })

        return { matchs, vainqueurs, ligues, prédictions, dates }
    })
    return résultat
}

const scrap = async() => {
    let browser = await puppeteer.launch({ headless: true })
    const urlList = await récupérerUrls(browser)

    let matchs = [];
    let vainqueurs = []
    let ligues = [];
    let prédictions = [];
    let dates = []

    //Tester toutes les urls
    for (var i = 0; i < urlList.length; i++) {
        console.log("Progression : " + i + "/" + urlList.length)
        const retour = await récupérerDonnées(browser, urlList[i])
        for (var j = 0; j < retour.matchs.length; j++) {
            matchs.push(retour.matchs[j])
            vainqueurs.push(retour.vainqueurs[j])
            ligues.push(retour.ligues[j])
            prédictions.push(retour.prédictions[j])
            dates.push(retour.dates[j])
        }
        await browser.close()
        browser = await puppeteer.launch({ headless: true })
    }

    return { matchs, vainqueurs, ligues, prédictions, dates }
}

scrap()
    .then(value => {
        console.log("--- RESULTATS ---")
        console.log("Lancement du serveur ROVBET...")
        var express = require('express');

        var app = express();

        app.use(express.static(__dirname + '/public'));

        app.get('/', function(req, res) {
            res.render('Rov.ejs', { value: value });
        });

        app.listen(8877);
        console.log("Serveur lancé !")

        //Tache de vérification toutes les heures
        var interval = 60 * 60 * 1000
        setInterval(function() {
            console.log("-- MISE A JOUR SITE --");
            scrap().then(value => {
                app.get('/', function(req, res) {
                    res.render('Rov.ejs', { value: value });
                });
            })
        }, interval);
    })