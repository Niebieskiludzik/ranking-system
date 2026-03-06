const SECRET_PASSWORD = "boisko"; // <-- wpisz swoje hasło

const playersList = [
  {id: "czarek", name: "Czarek"},
  {id: "patryk", name: "Patryk"},
  {id: "wiktor_p", name: "Wiktor P"},
  {id: "wiktor_h", name: "Wiktor H"},
  {id: "tymek", name: "Tymek"}
];

const playersRef = db.collection("players");
const ratingsRef = db.collection("ratings");
const historyRef = db.collection("history");
const roundsRef = db.collection("rounds");

const raterSelect = document.getElementById("rater");
const scoresDiv = document.getElementById("scores");

function generateScoreInputs() {
  scoresDiv.innerHTML = "";
  const rater = raterSelect.value;
  playersList.forEach(p => {
    if(p.id !== rater){
      const div = document.createElement("div");
      div.innerHTML = `<label>${p.name}: <input type="number" min="1" max="10" value="5" data-player="${p.id}"></label>`;
      scoresDiv.appendChild(div);
    }
  });
}
raterSelect.addEventListener("change", generateScoreInputs);
generateScoreInputs();

function getK(points){
  if(points < 1200) return 40;
  if(points < 2000) return 20;
  if(points < 3000) return 10;
  return 5;
}

document.getElementById("submit-round").addEventListener("click", async () => {
  const enteredPassword = document.getElementById("password").value;
  if(enteredPassword !== SECRET_PASSWORD){
    alert("Złe hasło!");
    return;
  }

  const rater = raterSelect.value;
  const scoreInputs = scoresDiv.querySelectorAll("input");
  const ratings = {};
  scoreInputs.forEach(input => {
    const playerId = input.dataset.player;
    const score = parseInt(input.value);
    if(score >=1 && score <=10){
      ratings[playerId] = score;
    }
  });

  const roundDoc = await roundsRef.add({ rater, date: new Date() });
  const roundId = roundDoc.id;

  const playersSnapshot = await playersRef.get();
  const playersData = {};
  playersSnapshot.forEach(doc => { playersData[doc.id] = {...doc.data()}; });

  let changes = [];
  Object.keys(ratings).forEach(pid => {
    const score = ratings[pid];
    const result = (score - 5)/5;
    const K = getK(playersData[pid].points);
    const change = K * result;
    changes.push({pid, change});
  });

  const avg = changes.reduce((sum,c)=>sum+c.change,0)/changes.length;
  changes = changes.map(c => ({pid: c.pid, change: c.change - avg}));

  for(const c of changes){
    const pid = c.pid;
    const change = Math.round(c.change);
    const oldPoints = playersData[pid].points;
    const newPoints = oldPoints + change;

    await ratingsRef.add({
      rater, rated: pid, score: ratings[pid], date: new Date(), round: roundId
    });

    await historyRef.add({
      player: pid, change, points_after: newPoints, date: new Date(), round: roundId
    });

    await playersRef.doc(pid).update({points: newPoints});
  }

  alert("Runda dodana!");
  generateScoreInputs();
  updateRanking();
  updatePodium();
  updateHistory();
});

async function updateRanking(){
  const snapshot = await playersRef.get();
  const players = [];
  snapshot.forEach(doc=>{players.push({id: doc.id, ...doc.data()});});
  players.sort((a,b)=>b.points - a.points);

  const tbody = document.querySelector("#ranking-table tbody");
  tbody.innerHTML = "";
  players.forEach((p,index)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${index+1}</td><td>${p.name}</td><td>${p.points}</td>`;
    tbody.appendChild(tr);
  });
}

async function updatePodium(){
  const snapshot = await playersRef.get();
  const players = [];
  snapshot.forEach(doc=>{players.push({id: doc.id, ...doc.data()});});
  players.sort((a,b)=>b.points - a.points);
  const podiumDiv = document.getElementById("podium");
  podiumDiv.innerHTML = "";
  ["🥇","🥈","🥉"].forEach((emoji,i)=>{
    if(players[i]){
      podiumDiv.innerHTML += `<p>${emoji} ${players[i].name} — ${players[i].points}</p>`;
    }
  });
}

async function updateHistory(){
  const snapshot = await historyRef.orderBy("date","desc").limit(20).get();
  const ul = document.getElementById("history");
  ul.innerHTML = "";
  snapshot.forEach(doc=>{
    const h = doc.data();
    const li = document.createElement("li");
    li.textContent = `${h.date.toDate().toLocaleString()} — ${playersList.find(p=>p.id===h.player).name} ${h.change>0?"+":""}${h.change} → ${h.points_after}`;
    ul.appendChild(li);
  });
}

updateRanking();
updatePodium();
updateHistory();
