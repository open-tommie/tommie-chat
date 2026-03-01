import { GameScene } from "./GameScene";

window.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    if (canvas) {
        new GameScene(canvas);
    }
});