from flask import Flask, render_template, request
from PIL import Image
import torch
from torchvision import models, transforms
from flask import send_from_directory

app = Flask(__name__)

PATH = "weights.pth"
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

model = models.resnet50()
model.load_state_dict(torch.load(PATH, map_location=device))

model = model.to(device)

model.eval()

with open("imagenet_classes.txt", "r") as f:
    classes = [line.strip() for line in f.readlines()]

def preprocess_image(img_path):
    img = Image.open(img_path)
    preprocess = transforms.Compose([
        transforms.Resize((256, 256)),
        transforms.ToTensor(),
    ])
    img = preprocess(img)
    img = img.unsqueeze(0)
    return img

def classify_image(img_path):
    img = preprocess_image(img_path)
    with torch.no_grad():
        output = model(img)
    probabilities = torch.nn.functional.softmax(output[0], dim=0)
    _, indices = torch.topk(probabilities, 4)
    results = [(classes[idx], round(probabilities[idx].item() * 100, 2)) for idx in indices]

    return results

@app.route('/')
def index():
    return render_template('index.html', result=None)

@app.route('/classify', methods=['POST'])
def classify():
    uploaded_file = request.files['image']

    if uploaded_file.filename != '':
        image_path = 'uploads/' + uploaded_file.filename
        uploaded_file.save(image_path)

        result = classify_image(image_path)
        uploaded_image_url = '/' + image_path

        return render_template('index.html', result=result, uploaded_image_url=uploaded_image_url)

    return render_template('index.html', result=None)

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory('uploads', filename)

if __name__ == '__main__':
    app.run(debug=True)
