const { Jimp } = require('jimp');

async function main() {
  try {
    const srcPath = 'C:\\Users\\Usuario\\.gemini\\antigravity\\brain\\882d5c51-4b0f-4f3e-ba06-c12d1479def2\\media__1780068559591.png';
    const destPath = 'C:\\Users\\Usuario\\.antigravity\\sawasdee_web\\public\\rollitos_primavera.jpg';
    
    console.log("Reading user's cropped image...");
    const original = await Jimp.read(srcPath);
    console.log(`Dimensions: ${original.width}x${original.height}`);

    console.log("Writing directly to destination as JPEG...");
    await original.write(destPath);
    console.log("Image saved successfully to:", destPath);
  } catch (err) {
    console.error("Error processing image:", err);
  }
}

main();
