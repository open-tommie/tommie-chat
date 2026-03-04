import { GameScene } from "./GameScene";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
if (canvas) {
    new GameScene(canvas);
} else {
    console.error("Canvas element 'renderCanvas' not found!");
}