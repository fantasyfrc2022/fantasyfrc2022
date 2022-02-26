let year = "2017";

let analyzeMode = false;

let playerTeamSelections = [
    { player: "Jacob", teams: ["971", "973", "111", "1571"] },
    { player: "Ryan", teams: ["148", "4613", "2122", "6036"] },
    { player: "Jody", teams: ["1323", "2481", "1986", "225"] }
];

// let playerTeamSelections = [
//     { player: "Ari", teams: ["1690", "1574", "3339", "2231"] },
//     { player: "Cait", teams: ["972", "8", "846", "3132"] },
//     { player: "Daniel", teams: ["1678", "125", "2046", "3683"] },
//     { player: "Andy", teams: ["254", "2767", "1241", "2122"] },
//     { player: "Justin", teams: ["5817", "7115", "4253", "6969"] },
//     { player: "Charles", teams: ["1323", "2910", "3015", "111"] },
//     { player: "Reid", teams: ["217", "3707", "5406", "1816"] },
//     { player: "Brian", teams: ["604", "4", "668", "5887"] },
//     { player: "Jody", teams: ["971", "1619", "225", "133"] },
//     { player: "Jerry", teams: ["2056", "195", "33", "48"] },
//     { player: "Holden", teams: ["973", "649", "1868", "1538"] },
//     { player: "Josh", teams: ["3476", "319", "4911", "5050"] },
//     { player: "Gautam", teams: ["118", "987", "3538", "610"] },
//     { player: "Ryan", teams: ["148", "67", "2168", "3847"] },
//     { player: "Jake", teams: ["179", "115", "191", "3128"] },
//     { player: "Carol", teams: ["1114", "3310", "359", "5026"] }
// ];

let tbaApiAuthorizationToken = "rGLrNsCbt8dp3lICNEjNx9gbxa071b4y5ez5cQvAXKPCMSNBOF6Ht8wT9p2gED1R";

let myHeaders = new Headers();
myHeaders.append("X-TBA-Auth-Key", tbaApiAuthorizationToken);
myHeaders.append("accept", "application/json");

let requestOptions = {
  method: 'GET',
  headers: myHeaders,
  redirect: 'follow'
};

let tier1Headers = {
    player: "Player",
    score: "Score"
};

let tier2Headers = {
    number: "Team",
    teamScore: "Overall Score",
    qualificationScore: "Average Event Score",
    championshipScore: "Championship Score",
    teamAge: "Team Age"
};

if (analyzeMode) {
    tier2Headers = {...tier2Headers, year: "Year"};
}

let tier3Headers = {
    eventName: "Event Name",
    eventScore: "Event Score",
    eventRankingScore: "Ranking Score",
    eventTopRank: "Top Rank",
    eventPlayoffWins: "Playoff Wins",
    eventAwards: "Awards"
};

let headers = analyzeMode ? tier2Headers : {...tier1Headers, ...tier2Headers, ...tier3Headers};

let sortHeader = "";
let sortAscending = true;

function sum(x, y) {
    return +x + +y;
};

function average(li) {
    return li.length === 0 ? 0 : li.reduce(sum, 0) / li.length;
}

async function calculateTeamEvent(team, event) {
    let status = await (await fetch(`https://www.thebluealliance.com/api/v3/team/frc${team}/event/${event.key}/status`, requestOptions)).json();
    let awards = await (await fetch(`https://www.thebluealliance.com/api/v3/team/frc${team}/event/${event.key}/awards`, requestOptions)).json();
    let eventRankingScore = +(5 * status?.qual?.ranking.sort_orders[0]).toFixed(2) || 0;
    let eventTopRank = status?.qual?.ranking.rank === 1 ? 2 : 0;
    let eventPlayoffWins = status?.playoff?.record.wins || 0;
    let eventAwards = 5 * awards.filter(award => [0, 69].includes(award.award_type)).length +
        4 * awards.filter(award => [9, 10].includes(award.award_type)).length +
        2 * awards.filter(award => [11, 13, 15, 16, 17, 18, 20, 21, 22, 27, 29, 30, 71].includes(award.award_type)).length;

    return {
        eventName: event.name,
        eventKey: event.key,
        eventType: event.event_type,
        eventScore: eventRankingScore + eventTopRank + eventPlayoffWins + eventAwards,
        eventRankingScore,
        eventTopRank,
        eventPlayoffWins,
        eventAwards
    }
};

async function calculateTeam(team, year) {
    let response = await fetch(`https://www.thebluealliance.com/api/v3/team/frc${team}/events/${year}/simple`, requestOptions);
    if (response.status != 200) {
        return {
            number: team,
            teamScore: 0,
            qualificationScore: 0,
            championshipScore: 0,
            teamAge: 0,
            events: {}
        };
    }
    response = await response.json();
    let events = await Promise.all(response.filter(event => event.event_type <= 5).sort((a, b) => a.start_date > b.start_date)
        .map(async event => calculateTeamEvent(team, event, year)));
    let qualificationScore = average(events.filter(event => [0, 1, 2, 5].includes(event.eventType)).map(event => event.eventScore)).toFixed(2);
    let championshipScore = events.filter(event => [3, 4].includes(event.eventType)).map(event => event.eventScore).reduce(sum, 0).toFixed(2);
    let rookieYear = (await (await fetch(`https://www.thebluealliance.com/api/v3/team/frc${team}`, requestOptions)).json()).rookie_year;
    let teamAge = rookieYear === 2020 ? 2 : rookieYear >= 2021 ? 5 : 0;

    return {
        number: team,
        year: `${team} ${year}`,
        teamScore: (+qualificationScore + +championshipScore + teamAge).toFixed(2),
        qualificationScore,
        championshipScore,
        teamAge,
        events
    };
}

async function calculatePlayer(player, year) {
    let teams = await Promise.all(player.teams.map(async team => calculateTeam(team, year)));
    return {
        player: player.player,
        score: teams.map(team => team.teamScore).reduce(sum, 0).toFixed(2),
        teams
    };
};

async function calculate() {
    return (await Promise.all(playerTeamSelections.map(async player => calculatePlayer(player, year)))).sort((a, b) => b.score - a.score);
}

async function analyzeTeam(team) {
    let teamYears = await Promise.all([2017, 2018, 2019, 2020].map(async year => calculateTeam(team, year)));
    return {
        player: team,
        score: +teamYears.map(team => team.teamScore).reduce(sum, 0).toFixed(2),
        teams: teamYears
    };
};

async function analyze() {
    let teams = [];
    let index = 0;
    var newPage;
    do {
        newPage = (await (await fetch(`https://www.thebluealliance.com/api/v3/teams/2022/${index}/simple`, requestOptions)).json())
            .map(team => team.team_number);
        teams = [...teams, ...newPage];
        index++;
    } while (newPage.length > 0);
    let s = 0;
    teams = teams.slice(start=s, end=s+100);
    // console.log(teams);
    return (await Promise.all(teams.map(async team => analyzeTeam(team))))/*.sort((a, b) => b.score - a.score)*/;
}

function generateScoresTable(data) {
    let table = document.getElementById("scores");
    let thead = table.createTHead();
    let row = thead.insertRow();
    for (let header of Object.values(headers)) {
        let th = document.createElement("th");
        let text = document.createTextNode(header);
        th.onclick = () => {
            var subset;
            let headerKey = Object.keys(headers).find(key => headers[key] === header);
            if (headerKey === sortHeader) {
                sortAscending = !sortAscending;
            } else {
                sortHeader = headerKey;
                sortAscending = true;
            }
            let compare = (a, b) => sortAscending ? (+a[headerKey] || a[headerKey]) > (+b[headerKey] || b[headerKey]) : (+b[headerKey] || b[headerKey]) > (+a[headerKey] || a[headerKey]);
            if (Object.values(tier1Headers).includes(header)) {
                subset = data.slice().sort(compare);
            } else if (Object.values(tier2Headers).includes(header)) {
                subset = data.map(player => ({...player, ...player.teams.sort(compare)}));
            } else if (Object.values(tier3Headers).includes(header)) {
                subset = data.map(player => ({...player, ...player.teams.map(team => ({...team, ...team.events.sort(compare)}))}));
            }
            scores.innerHTML = "";
            generateScoresTable(subset);
        };
        th.appendChild(text);
        row.appendChild(th);
    }

    for (let player of data) {
        for (let team of player.teams) {
            for (let event of team.events) {
                let row = table.insertRow();
                for (let header of Object.keys(headers)) {
                    let cell = row.insertCell();
                    var text = "";
                    if (header in tier1Headers && team === player.teams[0] && event === team.events[0]) {
                        cell.rowSpan = player.teams.map(team => team.events.length).reduce(sum, 0);
                        text = player[header];
                    } else if (header in tier2Headers && event === team.events[0]) {
                        cell.rowSpan = team.events.length;
                        text = team[header];
                    } else if (header in tier3Headers) {
                        text = event[header];
                    } else {
                        cell.remove();
                        continue;
                    }
                    let child = document.createTextNode(text);
                    cell.appendChild(child);
                }
            }
        }
    }

    document.getElementById("navigation").scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
}

function generateNaviationTable(data) {
    let table = document.getElementById("navigation");
    let thead = table.createTHead();
    let row = thead.insertRow();

    for (let subset of [data, ...data.sort((a, b) => a.player > b.player).map(player => [player])]) {
        let th = document.createElement("th");
        let child = document.createElement("button");
        child.innerHTML = subset.length === 1 ? subset[0].player : "All";
        child.onclick = () => {
            let scores = document.getElementById("scores");
            scores.innerHTML = "";
            sortHeader = "";
            sortAscending = true;
            generateScoresTable(subset);
        };
        th.appendChild(child);
        row.appendChild(th);
    }

    let th = document.createElement("th");
    let child = document.createElement("button");
    child.innerHTML = "Top Teams"
    child.onclick = () => {
        let scores = document.getElementById("scores");
        scores.innerHTML = "";
        sortHeader = "";
        sortAscending = true;
        generateScoresTable(data.map(player => player.teams.map(team => ({
            player: player.player,
            score: team.teamScore,
            teams: [team]
        }))).reduce((a, b) => a.concat(b), []).sort((a, b) => +b.score > +a.score).slice(start = 0, end = 10));
    };
    th.appendChild(child);
    row.appendChild(th);

    th = document.createElement("th");
    child = document.createElement("button");
    child.innerHTML = "Refresh"
    child.onclick = () => {
        let scores = document.getElementById("scores");
        scores.innerHTML = "";
        table.innerHTML = "";
        run();
    };
    th.appendChild(child);
    row.appendChild(th);
}

async function animateLoading() {
    var loading = document.getElementById("loading");
    if (loading.innerHTML.length >= 10) {
        loading.innerHTML = "Loading";
    } else {
        loading.innerHTML += ".";
    }
};

function exportToCsv() {
    var csv = [];
    var rows = document.querySelectorAll("table tr");
    for (var i = 0; i < rows.length; i++) {
        var row = [], cols = rows[i].querySelectorAll("td");
        for (var j = 0; j < cols.length; j++) 
            row.push(cols[j].innerText);
        row.length > 0 && csv.push(row.join(","));
    }
    csv = csv.join("\n") + "\n";
    console.log(csv);
    
    var dummy = document.createElement("textarea");
    document.body.appendChild(dummy);
    dummy.value = csv;
}

async function run() {
    window.scrollTo({ behavior: "smooth" })
    let loading = document.getElementById("loading");
    loading.innerHTML = "Loading";
    loading.style.padding = "20px";
    let loadingInterval = setInterval(animateLoading, 250);
    let data = analyzeMode ? await analyze() : await calculate();
    clearInterval(loadingInterval);
    loading.innerHTML = "";
    loading.style.padding = "0px";
    generateScoresTable(data);
    analyzeMode ? exportToCsv() : generateNaviationTable(data);
}

run();