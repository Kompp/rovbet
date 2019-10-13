/* ROVBET - DEVELOPPE PAR ALEXANDRE FOURNIER */
const puppeteer = require('puppeteer')
const request = require('request-promise');
var cheerio = require('cheerio')

const récupérerUrls = async() => {
    let urls = []
    for (var pageIndex = 1; pageIndex <= 6; pageIndex++)
        urls.push("http://www.betbot.soccer/?page=" + pageIndex + "&filter=true&period=upcoming&method=betbot&likelihood=every&odds=safe")
    return urls
}

const récupérerPrédictions = async(browser, url) => {

    //Chargement de la page des prédictions
    const res = await request({
        url,
        headers: {
            'User-Agent': 'Mozilla/5.0 (X11; CrOS x86_64 8172.45.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.64 Safari/537.36'
        }
    })
    const $ = cheerio.load(res)

    let matchs = [],
        vainqueurs = [],
        ligues = [],
        prédictions = [],
        dates = [],
        idVainqueur = []
        //idVainqueur = 0 si c'est l'équipe domicile qui devrait gagner, 1 pour l'équipe droite

    //Recherche des éléments de la page
    $('table tr').each(function(element) {
        let titres = $(this).find("b")

        if (titres.length != 0) {
            //Si c'est une ligue qui nous intéresse, continue le scraping; sinon arrête
            var ligue = titres.eq(0).parent().parent().find("h5").eq(0).html().substring(26)
            ligue = ligue.substring(0, ligue.indexOf("<"))
            if (ligue != "MLS" && ligue != "Premiership" && ligue != "League Two" && ligue != "Veikkausliiga" && ligue != "Superettan" && ligue != "League One") {
                //Titre du match
                matchs.push(titres.eq(0).html() + " - " + titres.eq(1).html())

                //Vainqueur
                if (titres.eq(0).parent().parent().find("h4").eq(0).text().includes("Win")) {
                    vainqueurs.push(titres.eq(0).innerHTML)
                    idVainqueur.push(0)
                } else {
                    vainqueurs.push(titres.eq(1).innerHTML)
                    idVainqueur.push(1)
                }

                //Ligue
                ligues.push(ligue)

                //Date
                let dateEl = titres.eq(0).parent().parent().find("h5").eq(0).html().substring(0, 10)
                dates.push(dateEl)

                //Remonter à l'élément tr
                let probas = titres.eq(0).parent().parent().find("h4").eq(0).parent()

                //Pourcentage de prédiction
                let probaSpan = probas.attr("data-original-title")
                let pourcentage = probaSpan.substring(probaSpan.indexOf(".") + 1)

                if (pourcentage.length == 2)
                    prédictions.push(pourcentage.substring(0, 1) + "0%")
                else
                    prédictions.push(pourcentage)
            }
        }
    })

    return {
        matchs,
        vainqueurs,
        ligues,
        prédictions,
        dates,
        idVainqueur
    }
}

const récupérerStatut = async(browser, url, prédictionOriginelle) => {
    const page = await browser.newPage()
        //Activer le logging à l'intérieur de page.evaluate
    page.on('console', consoleObj => console.log(consoleObj.text()))
    await page.goto(url)
    await page.waitFor('body')

    let résultat = page.evaluate((prédictionOriginelle) => {
        if (document.getElementsByClassName("imso_mh__ft-mtch imso-medium-font").length == 1) { //Match terminé
            let score1 = document.getElementsByClassName("imso_mh__l-tm-sc imso_mh__scr-it imso-light-font")[0].innerHTML
            let score2 = document.getElementsByClassName("imso_mh__r-tm-sc imso_mh__scr-it imso-light-font")[0].innerHTML
            let emojiRésultat = ((score1 > score2 && prédictionOriginelle == 0) || (score1 < score2 && prédictionOriginelle == 1)) ? " ✔️" : " ❌"
            let gain = (score1 > score2 && prédictionOriginelle == 0) || (score1 < score2 && prédictionOriginelle == 1) ? 1 : -1
            let score = score1 + " - " + score2 + emojiRésultat
            return { score, gain }
        } else if (document.getElementsByClassName("imso_mh__l-tm-sc imso_mh__scr-it imso-light-font").length == 1) { //Match en cours
            let score1 = document.getElementsByClassName("imso_mh__l-tm-sc imso_mh__scr-it imso-light-font")[0].innerHTML
            let score2 = document.getElementsByClassName("imso_mh__r-tm-sc imso_mh__scr-it imso-light-font")[0].innerHTML
            let gain = 0
            let score = score1 + " - " + score2 + " ⏱️"
            return { score, gain }
        } else {
            let score = null
            let gain = 0
            return { score, gain }
        }
    }, prédictionOriginelle)

    return résultat
}

const scrap = async() => {
    let browser = await puppeteer.launch({
        headless: true
    })
    const urlList = await récupérerUrls(browser)

    let matchs = [],
        vainqueurs = [],
        ligues = [],
        prédictions = [],
        dates = [],
        états = [],
        gains = []

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
        console.log("Progression : page n°" + (i + 1) + " ...")
        const retour = await récupérerPrédictions(browser, urlList[i])
        console.log("Progression : scraping google de ces données...")
        for (var j = 0; j < retour.matchs.length; j++) {
            matchs.push(retour.matchs[j])
            vainqueurs.push(retour.vainqueurs[j])
            ligues.push(retour.ligues[j])
            prédictions.push(retour.prédictions[j])
            dates.push(retour.dates[j])

            //Scraping de l'état du match
            if (vérifierÉtat) {
                url = 'http://www.google.com/search?q=' + retour.matchs[j]
                const état = await récupérerStatut(browser, url, retour.idVainqueur[j])
                vérifierÉtat = état != null
                états.push(état.score)
                gains.push(état.gain)
            }

            //Cas d'arret : plus de 2 jours après ou c'est le 1er et nous le 29
            matchday = (new Date(retour.dates[j])).getDate()
            finirScraping = matchday >= ajd.getDate() + 2 || (matchday == 1 && ajd.getDate() <= 29)
        }

        i++
        await browser.close()
        browser = await puppeteer.launch({
            headless: true
        })
    }
    console.log("Recherche terminée ! (" + matchday + "/" + ajd.getDate() + ")")

    return {
        matchs,
        vainqueurs,
        ligues,
        prédictions,
        dates,
        états,
        gains
    }
}

scrap()
    .then(value => {
        console.log("--- RESULTATS ---")
        console.log("Lancement du serveur ROVBET...")
        var express = require('express');

        var app = express();

        app.use(express.static(__dirname + '/public'));

        app.get('/', function(req, res) {
            res.render('Rov.ejs', {
                value: value
            });
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
                    res.render('Rov.ejs', {
                        value: value
                    });
                });
            })
        }, interval);
    })