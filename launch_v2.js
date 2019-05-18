const puppeteer = require('puppeteer')
const {
    performance,
    PerformanceObserver
} = require('perf_hooks');

const récupérerUrls = async browser => {
    let urls = []
    for (var pageIndex = 1; pageIndex <= 6; pageIndex++)
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

const récupérerStatut = async(browser, url) => {
    const page = await browser.newPage()
        //Activer le logging à l'intérieur de page.evaluate
    page.on('console', consoleObj => console.log(consoleObj.text()))
    await page.goto(url)
    await page.waitFor('body')

    let résultat = page.evaluate(() => {
        if (document.getElementsByClassName("imso_mh__l-tm-sc imso_mh__scr-it imso-light-font").length == 1) { //Match terminé
            let score1 = document.getElementsByClassName("imso_mh__l-tm-sc imso_mh__scr-it imso-light-font")[0].innerHTML
            let score2 = document.getElementsByClassName("imso_mh__r-tm-sc imso_mh__scr-it imso-light-font")[0].innerHTML
            return score1 + " - " + score2
        } else {
            return null
        }
    })

    return résultat
}

const scrap = async() => {
    let browser = await puppeteer.launch({ headless: true })
    const urlList = await récupérerUrls(browser)

    let matchs = []
    let vainqueurs = []
    let ligues = []
    let prédictions = []
    let dates = []
    let états = []

    var q = new Date();
    var m = q.getMonth();
    var d = q.getDate();
    var y = q.getFullYear();
    var ajd = new Date(y, m, d);

    //Tester toutes les urls
    var finirScraping = false
    var vérifierÉtat = true //Changer 
    var i = 0
    var matchday

    while (!finirScraping && i < urlList.length) {
        console.log("Progression : page n°" + i + " ...")
        const retour = await récupérerDonnées(browser, urlList[i])
        for (var j = 0; j < retour.matchs.length; j++) {
            matchs.push(retour.matchs[j])
            vainqueurs.push(retour.vainqueurs[j])
            ligues.push(retour.ligues[j])
            prédictions.push(retour.prédictions[j])
            dates.push(retour.dates[j])

            //Scraping de l'état du match
            if (vérifierÉtat) {
                url = 'http://www.google.com/search?q=' + retour.matchs[j]
                const état = await récupérerStatut(browser, url)
                console.log(retour.matchs[j] + "/" + état)
                vérifierÉtat = état != null
                états.push(état)
            }

            //Cas d'arret : plus de 2 jours après ou c'est le 1er et nous le 29
            matchday = (new Date(retour.dates[j])).getDate()
            finirScraping = matchday >= ajd.getDate() + 2 || (matchday == 1 && ajd.getDate() <= 29)
        }

        i++
        await browser.close()
        browser = await puppeteer.launch({ headless: true })
    }
    console.log("Recherche terminée ! (" + matchday + "/" + ajd.getDate() + ")")

    return { matchs, vainqueurs, ligues, prédictions, dates, états }
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

        const PORT = process.env.PORT || 3000;

        app.listen(PORT);
        console.log("Serveur lancé !")

        //Tache de vérification toutes les 45 mn 
        var interval = 45 * 60 * 1000
        setInterval(function() {
            console.log("-- MISE A JOUR SITE --");
            scrap().then(value => {
                app.get('/', function(req, res) {
                    res.render('Rov.ejs', { value: value });
                });
            })
        }, interval);
    })