import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter";
import { ViewHelper } from "three/examples/jsm/helpers/ViewHelper";

let renderer, scene;
function init(contours, camera, controls, helper, clock, shape, mesh, geometry) {
  const scale = 10;

  if (renderer) {
    renderer.dispose();
  }

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.autoClear = false;
  document.body.appendChild(renderer.domElement);

  clock = new THREE.Clock();
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  // camera
  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 10000);
  camera.position.set(0, 0, 15 * scale);

  // controls
  controls = new OrbitControls(camera, renderer.domElement);

  // ambient
  scene.add(new THREE.AmbientLight());

  // light
  const directionalLight = new THREE.DirectionalLight(0xfeffff, 7);
  directionalLight.position.set(-8 * scale, 10 * scale, 20 * scale);
  const dlhelper = new THREE.DirectionalLightHelper(directionalLight, 10);
  scene.add(directionalLight);

  const directionalLight2 = new THREE.DirectionalLight(0xfeffff, 7);
  directionalLight2.position.set(8 * scale, 10 * scale, 20 * scale);
  const dlhelper2 = new THREE.DirectionalLightHelper(directionalLight2, 10);
  scene.add(directionalLight2);

  scene.add(dlhelper);
  scene.add(dlhelper2);

  for (const contour of contours) {
    if (contour == contours[0]) {
      const points = contour.map((pt) => new THREE.Vector2(pt.x / scale, pt.y / scale));
      points.push(points[0]);
      shape = new THREE.Shape(points);
      continue;
    }
    const hole = contour.map((pt) => new THREE.Vector2(pt.x / scale, pt.y / scale));
    hole.push(hole[0]);
    shape.holes.push(new THREE.Shape(hole));
  }

  // Define extrusion settings
  let extrudeSettings = {
    // steps: 15,
    depth: 500 / scale, // Depth to extrude
    bevelEnabled: false,
  };

  geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geometry.center();
  geometry.rotateX(THREE.MathUtils.degToRad(90));
  mesh = new THREE.Mesh(geometry);

  // Call the export function
  exportToOBJ(mesh);

  // Define the threshold (adjust as needed)
  const threshold = 0.99; // You can adjust this value

  // Get the positions from the BufferGeometry
  const positions = geometry.getAttribute("position").array;

  const materials = [];

  const colors = [
    0xeeeeee, // Top
    0xbfbcb4, // Walls
  ];

  let colorIndex = 0;

  for (let i = 0; i < positions.length; i += 9) {
    // Get the vertices of the face
    const vertex1 = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
    const vertex2 = new THREE.Vector3(positions[i + 3], positions[i + 4], positions[i + 5]);
    const vertex3 = new THREE.Vector3(positions[i + 6], positions[i + 7], positions[i + 8]);

    // Calculate face normal
    const faceNormal = new THREE.Vector3()
      .crossVectors(vertex2.sub(vertex1), vertex3.sub(vertex1))
      .normalize();

    // Calculate the dot product between the face normal and each axis unit vector
    for (let j = 0; j < colors.length; j++) {
      const dotProduct = Math.abs(
        faceNormal.dot(
          new THREE.Vector3(Math.cos((j * Math.PI) / 3), Math.sin((j * Math.PI) / 3), 0),
        ),
      );

      // Check if the face is approximately perpendicular to an axis within the threshold
      if (dotProduct >= threshold) {
        const material = new THREE.MeshStandardMaterial({
          color: colors[colorIndex],
          roughness: 0.1,
          metalness: 0.5,
          side: THREE.BackSide,
        });
        materials.push(material);
        colorIndex = (colorIndex + 1) % colors.length;
        break;
      }
    }
  }

  scene.add(new THREE.Mesh(geometry, materials));

  var geom = new THREE.EdgesGeometry(mesh.geometry);

  var lineMaterial = new THREE.LineBasicMaterial({ color: 0xababa9 });
  var wireframe = new THREE.LineSegments(geom, lineMaterial);
  // wireframe.rotateX(THREE.MathUtils.degToRad(90));
  // scene.add( wireframe );

  const boundingBox = mesh.geometry.boundingBox;
  const mesh_length = boundingBox.max.x - boundingBox.min.x;
  const mesh_height = boundingBox.max.y - boundingBox.min.y;
  const mesh_width = boundingBox.max.z - boundingBox.min.z;

  for (let i = 0; i < 10; i++) {
    const shapegeo = new THREE.ShapeGeometry(shape);
    shapegeo.center();
    const planegeometry = new THREE.EdgesGeometry(shapegeo);
    planegeometry.translate(0, 0, (-1 * mesh_height) / 2 + scale * i * 0.2);
    planegeometry.rotateX(THREE.MathUtils.degToRad(90));
    const material = new THREE.LineBasicMaterial({
      color: 0xababa9,
      side: THREE.DoubleSide,
      transparent: true,
    });
    scene.add(new THREE.LineSegments(planegeometry, material));
  }

  // helper
  helper = new ViewHelper(camera, renderer.domElement);
  helper.controls = controls;
  helper.controls.center = controls.target;
  const div = document.createElement("div");
  div.id = "viewHelper";
  div.style.position = "absolute";
  div.style.right = 0;
  div.style.bottom = 0;
  div.style.height = "128px";
  div.style.width = "128px";

  // document.body.appendChild( div );

  div.addEventListener("pointerup", (event) => helper.handleClick(event));
  // helper.div.addEventListener( 'pointerup', (event) => helper.handleClick( event ) );

  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (helper.animating) helper.update(delta);

    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissor(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(true);

    renderer.clear();

    renderer.render(scene, camera);
    helper.render(renderer);
  }

  animate();
}

let imgElement = document.getElementById("imageSrc");
let inputElement = document.getElementById("fileInput");
inputElement.addEventListener(
  "change",
  (e) => {
    imgElement.src = URL.createObjectURL(e.target.files[0]);
  },
  false,
);
imgElement.onload = function () {
  // Assuming 'imageId' is the ID of an img tag from which you want to read
  let src = cv.imread(imgElement);

  let dst = new cv.Mat();
  let gray = new cv.Mat();
  // Convert to grayscale
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

  // Threshold or use edge detection
  cv.threshold(gray, dst, 127, 255, cv.THRESH_BINARY_INV);

  // Find contours
  let allContours = new cv.MatVector();
  let hierarchy = new cv.Mat();
  cv.findContours(dst, allContours, hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);
  // allContours, _ = cv2.findContours(binary, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

  const contours = contoursToJSON(allContours);
  // contours = allContours.map(contour => Array.from(contour));
  src.delete();
  hierarchy.delete();
  gray.delete();
  allContours.delete();
  // console.log(contours);

  init(contours);
};
var Module = {
  // https://emscripten.org/docs/api_reference/module.html#Module.onRuntimeInitialized
  onRuntimeInitialized() {
    document.getElementById("status").innerHTML = "OpenCV.js is ready.";
  },
};

function contoursToJSON(contours) {
  let jsonContours = [];

  for (let i = 0; i < contours.size(); i++) {
    let contour = contours.get(i);
    let points = [];

    for (let j = 0; j < contour.data32S.length; j += 2) {
      points.push({ x: contour.data32S[j], y: contour.data32S[j + 1] });
    }

    jsonContours.push(points);
  }

  return jsonContours;
}



// Function to export the geometry to OBJ format
function exportToOBJ(mesh) {

  // Create an OBJ exporter
  var exporter = new OBJExporter();

  // Export the mesh as an OBJ string
  var objData = exporter.parse(mesh);

  // Download the OBJ file
  var blob = new Blob([objData], { type: "text/plain" });
  var link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "exported_model.obj";
  link.click();
}
