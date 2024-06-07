from flask import Flask, render_template, request
import requests
import threading
import requests

app = Flask(__name__)

validIPs = {}

def checkIP(num):
    global validIPs
    print(f"checking {num}")
    try:
        response = requests.get(f"http://192.168.1.{num}:9111/v1.0/vehicle_name", timeout=4)
        if response.status_code == 200:
            # print(f"found! {num}")
            validIPs.setdefault(response.text.strip('"'), []).append(f"192.168.1.{num}")
        else:
            # print(f"nothing at {num}")
            pass
    
    except requests.Timeout:
        # Handle timeout error
        # print(f"timeout at {num}")
        pass
    except requests.RequestException as e:
        # Handle other request-related errors
        # print(f"nothing at {num}")
        pass

@app.route('/')
def config():
    return render_template('index.html')

@app.route('/request', methods=["POST"])
def forward_request():
    url = request.args.get('url')
    if url:
        print(url)
        forwarded_response = requests.post(url)
        return forwarded_response.text, forwarded_response.status_code
        
    else:
        return {'error': 'URL not provided in the request'}, 400

@app.route('/postWithURL', methods=["POST"])
def postWithURL():
    url = request.args.get('url')
    body = request.args.get('body')
    response = requests.post(url, json=body, headers={'Content-Type': 'application/json'})
    return "ok"

@app.route('/getFromURL', methods=["GET"])
def getFromURL():
    url = request.args.get('url')
    response = requests.get(url)
    return response.text

# http://192.168.1.171/mavlink-camera-manager/thumbnail?source=/dev/video0&quality=75&target_height=150
@app.route('/getThumbnail', methods=["GET"])
def getThumbnail():
    ip = request.args.get('ip')
    response = requests.get(f"http://{ip}/mavlink-camera-manager/thumbnail?source=/dev/video0&quality=75&target_height=150")
    return response.content

@app.route('/scan')
def scan():
    global validIPs
    validIPs = {}

    threads = []
    for num in range(0,256):
        thread = threading.Thread(target=checkIP, args=(num,))
        thread.start()
        threads.append(thread)
    
    # Wait for all threads to finish
    for thread in threads:
        thread.join()

    return validIPs

# def scan():
#     jdata = {}
    
#     response = requests.get("http://192.168.1.65:9111/v1.0/vehicle_name")
#     jdata['vehicleName'] = response.text

#     response = requests.get("http://192.168.1.65:9111/v1.0/ip")
#     jdata['ip'] = response.text

#     response = requests.get("http://192.168.1.65:9111/v1.0/hostname")
#     jdata['hostname'] = response.text


#     return jdata

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000)