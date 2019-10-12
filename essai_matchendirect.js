const puppeteer = require('puppeteer')

const récupérerUrls = async browser => {
    let urls = []
    urls.push("https://www.matchendirect.fr/prevu/asc/")
    return urls
}

const récupérerDonnées = async(browser, url) => {
    const page = await browser.newPage()
        //Activer le logging à l'intérieur de page.evaluate
    page.on('console', consoleObj => console.log(consoleObj.text()));
    await page.goto(url)
    await page.waitFor('body')

    let résultat = page.evaluate(() => {
        let matchs = [],
            vainqueurs = [],
            ligues = [] //,
            //prédictions = [],
            //dates = [],
            //idVainqueur = []
            //idVainqueur = 0 si c'est l'équipe domicile qui devrait gagner, 1 pour l'équipe droite

        //Recherche des éléments de la page
        Array.from(document.querySelectorAll('table tr')).forEach(function(element) {
            let titre1 = element.getElementsByClassName("lm3_eq1")
            let titre2 = element.getElementsByClassName("lm3_eq2")

            //Titre du match
            matchs.push(titre1.textContent + " - " + titre2.textContent)
            console.log(titre1.textContent + " - " + titre2.textContent)

            //Ligue
            let ligue = titre1.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement
            ligues.push(ligue.getElementsByClassName("panel-heading livescore_head")[0].textContent)
                /*
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
                    prédictions.push(pourcentage)*/
        })

        return {
            matchs,
            vainqueurs,
            ligues,
            /*prédictions,
            dates,
            idVainqueur*/
        }
    })

    return résultat
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
        headless: false
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
        console.log("Recherche matchendirect..." + (i + 1) + " ...")
        const retour = await récupérerDonnées(browser, urlList[i])
        console.log("Progression : Scraping google de ces données...")

        /*for (var j = 0; j < retour.matchs.length; j++) {
            matchs.push(retour.matchs[j])
            vainqueurs.push(retour.vainqueurs[j])
            ligues.push(retour.ligues[j])
            prédictions.push(retour.prédictions[j])
            dates.push(retour.dates[j])

            //Scraping de l'état du match
            if (vérifierÉtat) {
                if (retour.ligues[j] != "MLS" && retour.ligues[j] != "Veikkausliiga" && retour.ligues[j] != "Superettan" && retour.ligues[j] != "League One") {
                    url = 'http://www.google.com/search?q=' + retour.matchs[j]
                    const état = await récupérerStatut(browser, url, retour.idVainqueur[j])
                    vérifierÉtat = état != null
                    états.push(état.score)
                    gains.push(état.gain)
                } else {
                    états.push(null)
                    gains.push(null)
                }
            }

            //Cas d'arret : plus de 2 jours après ou c'est le 1er et nous le 29
            matchday = (new Date(retour.dates[j])).getDate()
            finirScraping = matchday >= ajd.getDate() + 2 || (matchday == 1 && ajd.getDate() <= 29)
        }*/

        i++
        await browser.close()
        browser = await puppeteer.launch({
            headless: false
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
        console.log(value)
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