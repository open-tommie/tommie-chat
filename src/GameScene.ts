import { 
    Engine, 
    Scene, 
    Vector3, 
    Vector4,
    Color4,
    MeshBuilder, 
    HemisphericLight, 
    ArcRotateCamera, 
    StandardMaterial, 
    Color3,
    Mesh,
    Texture,
    TransformNode 
} from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock, Rectangle } from "@babylonjs/gui";
import "@babylonjs/loaders";
import { GridMaterial } from "@babylonjs/materials";

export class GameScene {
    private engine: Engine;
    private scene: Scene;
    private camera!: ArcRotateCamera;
    private playerBox!: Mesh;

    constructor(canvas: HTMLCanvasElement) {
        this.engine = new Engine(canvas, false);
        const dpr = window.devicePixelRatio || 1.0;
        this.engine.setHardwareScalingLevel(1 / dpr);
        console.log("[初期化] DPR:", dpr);

        this.scene = new Scene(this.engine);

        this.setupScene();
        this.createObjects();

        this.handleResize();

        this.engine.runRenderLoop(() => {
            if (this.scene.activeCamera) {
                this.scene.render();
            }
        });

        window.addEventListener("resize", () => {
            requestAnimationFrame(() => this.handleResize());
        });
    }

    private setupScene(): void {
        this.camera = new ArcRotateCamera(
            "camera", 
            -Math.PI / 3.2,
            Math.PI / 2,
            6.0,
            new Vector3(0, 0.9, 0),
            this.scene
        );
        this.camera.attachControl(this.engine.getRenderingCanvas() as HTMLCanvasElement, true);

        this.camera.lowerRadiusLimit = 3;
        this.camera.upperRadiusLimit = 50;
        this.camera.fovMode = ArcRotateCamera.FOVMODE_VERTICAL_FIXED;
        this.camera.inertia = 0;

        const light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);
        light.intensity = 1.8;
        light.groundColor = new Color3(0.9, 0.9, 0.9);

        this.scene.clearColor = new Color4(0.53, 0.81, 0.98, 1.0);
        this.scene.ambientColor = new Color3(0.65, 0.65, 0.75);
    }

    private createObjects(): void {
        // 地面
        const ground = MeshBuilder.CreateGround("ground", { width: 100, height: 100 }, this.scene);
        const gridMaterial = new GridMaterial("gridMaterial", this.scene);
        gridMaterial.mainColor = new Color3(0.85, 0.95, 0.85);
        gridMaterial.lineColor = new Color3(0.35, 0.55, 0.35);
        gridMaterial.gridRatio = 1.0;
        gridMaterial.majorUnitFrequency = 5;
        gridMaterial.opacity = 1.0;
        ground.material = gridMaterial;

        // アバター（長方形）
        const faceUV = new Array(6);
        const faceColors = new Array(6);
        for (let i = 0; i < 6; i++) {
            faceUV[i] = new Vector4(0, 0, 1, 1);
            faceColors[i] = new Color4(1, 1, 1, 1);
        }
        faceUV[1] = new Vector4(0, 0, 0, 0);
        faceColors[1] = new Color4(0.45, 0.45, 0.45, 1);
        faceUV[2] = new Vector4(0, 0, 0, 0);
        faceUV[3] = new Vector4(0, 0, 0, 0);
        faceColors[2] = new Color4(0.75, 0.75, 0.75, 1);
        faceColors[3] = new Color4(0.75, 0.75, 0.75, 1);
        faceUV[4] = new Vector4(0, 0, 0, 0);
        faceColors[4] = new Color4(0.65, 0.65, 0.65, 1);
        faceUV[5] = new Vector4(0, 0, 0, 0);
        faceColors[5] = new Color4(0.75, 0.75, 0.75, 1);

        const width = 1.0;
        const height = 1.5;
        const depth = 0.25;

        this.playerBox = MeshBuilder.CreateBox("playerBox", { 
            width, height, depth,
            faceUV, faceColors
        }, this.scene);

        this.playerBox.position.y = height / 2;

        // ★ 表をカメラ方向（Z負、(0,-10)側）に向ける ★
        this.playerBox.rotation.y = Math.PI;

        const boxMaterial = new StandardMaterial("boxMaterial", this.scene);
        boxMaterial.diffuseColor = new Color3(1, 1, 1);

        const ktxTexture = new Texture(
            "/textures/cube.ktx2",
            this.scene,
            false,
            false,
            Texture.TRILINEAR_SAMPLINGMODE
        );
        boxMaterial.diffuseTexture = ktxTexture;
        this.playerBox.material = boxMaterial;

        // 雲（高さで色を変化）
        this.createMinecraftClouds();

        // セリフ吹き出し
        this.createSpeechBubble();

        // 地面の座標ラベル
        this.createCoordinateLabels();

        this.resetCameraScale();
    }

    private createMinecraftClouds(): void {
        for (let i = 0; i < 6; i++) {
            const cloudGroup = new TransformNode(`cloudGroup${i}`, this.scene);

            const baseX = (Math.random() - 0.5) * 140;
            const baseZ = (Math.random() - 0.5) * 140;
            const baseY = 18 + Math.random() * 12;

            // ★ 高さで色を変化（低いほどグレイ、高いほど白） ★
            const heightFactor = (baseY - 18) / 12;           // 0.0〜1.0
            const gray = 0.82 + heightFactor * 0.16;          // 0.82（グレイ）〜0.98（白）

            const cloudMaterial = new StandardMaterial(`cloudMat${i}`, this.scene);
            cloudMaterial.diffuseColor = new Color3(gray, gray, gray + 0.03);
            cloudMaterial.specularColor = new Color3(0, 0, 0);
            cloudMaterial.alpha = 0.95;

            const numSpheres = 4 + Math.floor(Math.random() * 3);
            for (let j = 0; j < numSpheres; j++) {
                const size = 4 + Math.random() * 5;
                const sphere = MeshBuilder.CreateSphere(`cloudSphere${i}_${j}`, {
                    diameter: size,
                    segments: 8
                }, this.scene);
                sphere.position.set(
                    baseX + (Math.random() - 0.5) * 8,
                    baseY + (Math.random() - 0.5) * 4,
                    baseZ + (Math.random() - 0.5) * 8
                );
                sphere.scaling.set(1.4, 0.65, 1.1);
                sphere.material = cloudMaterial;
                sphere.parent = cloudGroup;
            }
        }
    }

    private createCoordinateLabels(): void {
        const step = 10;
        const range = 50;

        for (let x = -range; x <= range; x += step) {
            this.createSingleLabel(x, 0, `(${x},0)`);
        }
        for (let z = -range; z <= range; z += step) {
            if (z !== 0) {
                this.createSingleLabel(0, z, `(0,${z})`);
            }
        }
    }

    private createSingleLabel(x: number, z: number, labelText: string): void {
        const plane = MeshBuilder.CreatePlane(`coordLabel_${x}_${z}`, { 
            width: 3.5, 
            height: 1.2 
        }, this.scene);

        plane.rotation.x = Math.PI / 2;
        plane.position.set(x, 0.02, z);

        const texture = AdvancedDynamicTexture.CreateForMesh(plane);

        const bg = new Rectangle();
        bg.width = "100%";
        bg.height = "100%";
        bg.background = "rgba(255,255,255,0.85)";
        bg.cornerRadius = 12;
        bg.thickness = 2;
        texture.addControl(bg);

        const text = new TextBlock();
        text.text = labelText;
        text.color = "#FF0000";
        text.fontSize = "48px";
        text.fontFamily = "Arial";
        text.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_CENTER;
        text.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_CENTER;
        bg.addControl(text);
    }

    private createSpeechBubble(): void {
        const bubblePlane = MeshBuilder.CreatePlane("speechBubble", { 
            width: 1.6, 
            height: 0.55 
        }, this.scene);
        
        bubblePlane.position.set(1.5, this.playerBox.position.y +1.2, 0);
        bubblePlane.billboardMode = Mesh.BILLBOARDMODE_ALL;

        const advancedTexture = AdvancedDynamicTexture.CreateForMesh(bubblePlane);

        const background = new Rectangle();
        background.width = "100%";
        background.height = "100%";
        background.cornerRadius = 100;
        background.thickness = 3;
        background.color = "white";
        background.background = "rgba(255,255,255,0.50)";
        advancedTexture.addControl(background);

        const textBlock = new TextBlock();
        textBlock.text = "Hello, World!\n\nこんにちは！⭐️";
        textBlock.color = "black";
        textBlock.fontSize = "124px";
        textBlock.fontFamily = "Arial";
        textBlock.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_CENTER;
        textBlock.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_CENTER;
        background.addControl(textBlock);
    }

    private handleResize(): void {
        const dpr = window.devicePixelRatio || 1.0;
        this.engine.setHardwareScalingLevel(1 / dpr);
        this.engine.resize(true);

        if (this.camera && this.playerBox) {
            this.resetCameraScale();
            this.scene.render();
        }
    }

    private resetCameraScale(): void {
        const safeHeight = window.innerHeight || 
                          (this.engine.getRenderingCanvas() as HTMLCanvasElement).clientHeight;

        let radius = safeHeight / 22;
        radius = Math.max(8, Math.min(30, radius));

        this.camera.setTarget(this.playerBox.position.clone());
        this.camera.radius = radius;
        this.camera.rebuildAnglesAndRadius();
        this.camera.inertia = 0;
    }
}