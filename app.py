from flask import Flask, jsonify, request, render_template, send_from_directory
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory("static", filename)

TCDD_URL = "https://bilet.tcdd.gov.tr/api/v1/availability"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

@app.route("/health")
def health():
    return jsonify({"status": "ok"})

@app.route("/check", methods=["POST"])
def check():
    body = request.json
    kalkis = body.get("kalkis")
    varis = body.get("varis")
    tarih = body.get("tarih")
    saat = body.get("saat")  # "09:00" gibi, None ise tüm seferler

    if not all([kalkis, varis, tarih]):
        return jsonify({"error": "kalkis, varis ve tarih zorunlu"}), 400

    try:
        payload = {
            "departureStation": kalkis,
            "arrivalStation": varis,
            "departureDate": tarih,
            "passengerCount": 1
        }
        r = requests.post(TCDD_URL, json=payload, headers=HEADERS, timeout=10)
        r.raise_for_status()
        data = r.json()
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"TCDD'ye erişilemedi: {str(e)}"}), 502

    trains = data.get("trains", [])
    results = []

    for t in trains:
        dep_time = t.get("departureTime", "")
        dep_short = dep_time[:5] if dep_time else ""
        available = t.get("availableSeats", 0)

        if saat and dep_short != saat:
            continue

        results.append({
            "saat": dep_short,
            "kalkis_saati": dep_time,
            "varis_saati": t.get("arrivalTime", ""),
            "musait_koltuk": available,
            "bos": available > 0,
            "tren_adi": t.get("trainName", ""),
        })

    return jsonify({
        "kalkis": kalkis,
        "varis": varis,
        "tarih": tarih,
        "aranan_saat": saat,
        "seferler": results,
        "bilet_var": any(s["bos"] for s in results),
    })

if __name__ == "__main__":
    app.run(debug=True)
