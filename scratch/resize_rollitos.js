const fs = require('fs');

async function test() {
  try {
    // We can load jimp. Since it's in the node_modules, we require it.
    const { Jimp } = require('jimp');
    console.log("Jimp loaded successfully!");
    const image = await Jimp.read('C:\\Users\\Usuario\\.antigravity\\sawasdee_web\\public\\rollitos_primavera.jpg');
    console.log(`Dimensions: ${image.width}x${image.height}`);
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
