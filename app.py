from flask import Flask

app = Flask(__name__)

@app.route("/")
def home():
    return """
<!DOCTYPE html>
<html>
<head>
<title>Clifford Bone Chase</title>
<style>
body{background:#111;color:white;text-align:center;font-family:Arial}
canvas{background:#222;border:4px solid #00ff99;margin-top:20px}
</style>
</head>
<body>
<h1>Clifford Bone Chase</h1>
<p>Use arrow keys to move. Chase the bone!</p>
<canvas id="game" width="500" height="500"></canvas>
<h2 id="score">Score: 0</h2>

<script>
const canvas=document.getElementById("game");
const ctx=canvas.getContext("2d");
const box=25;
let dog=[{x:250,y:250}];
let bone={x:100,y:100};
let dx=box, dy=0;
let score=0;

document.addEventListener("keydown", e=>{
 if(e.key==="ArrowUp" && dy===0){dx=0;dy=-box}
 if(e.key==="ArrowDown" && dy===0){dx=0;dy=box}
 if(e.key==="ArrowLeft" && dx===0){dx=-box;dy=0}
 if(e.key==="ArrowRight" && dx===0){dx=box;dy=0}
});

function drawBone(){
 ctx.fillStyle="white";
 ctx.font="24px Arial";
 ctx.fillText("🦴", bone.x, bone.y+22);
}

function gameLoop(){
 ctx.clearRect(0,0,500,500);

 let head={x:dog[0].x+dx,y:dog[0].y+dy};

 if(head.x<0||head.x>=500||head.y<0||head.y>=500){
   alert("Game over! Score: "+score);
   dog=[{x:250,y:250}]; dx=box; dy=0; score=0;
 }

 dog.unshift(head);

 if(Math.abs(head.x-bone.x)<box && Math.abs(head.y-bone.y)<box){
   score++;
   document.getElementById("score").innerText="Score: "+score;
   bone={
     x:Math.floor(Math.random()*20)*box,
     y:Math.floor(Math.random()*20)*box
   };
 } else {
   dog.pop();
 }

 ctx.fillStyle="#00ff99";
 dog.forEach(part=>ctx.fillRect(part.x,part.y,box-2,box-2));

 ctx.fillStyle="red";
 ctx.font="24px Arial";
 ctx.fillText("🐶", dog[0].x, dog[0].y+22);

 drawBone();
}

setInterval(gameLoop,150);
</script>
</body>
</html>
"""
