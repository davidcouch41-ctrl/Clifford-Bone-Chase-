from flask import Flask

app = Flask(__name__)

@app.route("/")
def home():
    return """
    <html>
    <head>
        <title>Clifford Bone Chase</title>
        <style>
            body{
                background:#111;
                color:white;
                font-family:Arial;
                text-align:center;
                padding-top:100px;
            }
            h1{
                font-size:60px;
                color:#00ff99;
            }
            p{
                font-size:24px;
            }
        </style>
    </head>
    <body>
        <h1>Clifford Bone Chase</h1>
        <p>The game site is now live on Render.</p>
    </body>
    </html>
    """
