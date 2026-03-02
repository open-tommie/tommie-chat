import { 
    Engine, 
    Scene, 
    Vector3, 
    Vector4,
    Color4,
    MeshBuilder, 
    HemisphericLight, 
    ArcRotateCamera, 
    PBRMaterial,      
    StandardMaterial, 
    Color3,
    Mesh,
    Texture,
    TransformNode,
    SceneInstrumentation,
    EngineInstrumentation,
    PointerEventTypes,
    DefaultRenderingPipeline 
} from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock, Rectangle, Control, Grid, Button } from "@babylonjs/gui"; 
import "@babylonjs/loaders";
import { GridMaterial } from "@babylonjs/materials";

export class GameScene {
    private engine: Engine;
    private scene: Scene;
    private camera!: ArcRotateCamera;
    private playerBox!: Mesh;

    private targetPosition: Vector3 | null = null;
    private readonly moveSpeed = 2.0; 
    
    private hoverMarker!: Mesh;
    private clickMarker!: Mesh;

    private updatePlayerSpeech!: (newText: string) => void;

    private renderingPipeline!: DefaultRenderingPipeline;

    constructor(canvas: HTMLCanvasElement) {
        this.engine = new Engine(canvas, false);
        this.engine.setHardwareScalingLevel(1.0);

        this.scene = new Scene(this.engine);

        this.setupScene();
        this.createObjects();
        this.setupHtmlUI(); 

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
        this.camera.maxZ = 2000;

        const light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);
        light.intensity = 1.8;
        light.groundColor = new Color3(0.9, 0.9, 0.9);

        this.scene.clearColor = new Color4(0.53, 0.81, 0.98, 1.0);
        this.scene.ambientColor = new Color3(0.65, 0.65, 0.75);

        this.renderingPipeline = new DefaultRenderingPipeline(
            "defaultPipeline", 
            false, 
            this.scene, 
            [this.camera]
        );
        this.renderingPipeline.samples = 1; 
    }

    private setupHtmlUI(): void {
        const textarea = document.getElementById("chatInput") as HTMLTextAreaElement;
        const sendBtn = document.getElementById("sendBtn") as HTMLButtonElement;
        const clearBtn = document.getElementById("clearBtn") as HTMLButtonElement;

        if (!textarea || !sendBtn || !clearBtn) return;

        const sendMessage = () => {
            const text = textarea.value.trim();
            if (this.updatePlayerSpeech) {
                this.updatePlayerSpeech(text);
                textarea.value = "";
            }
        };

        clearBtn.onclick = () => {
            if (this.updatePlayerSpeech) this.updatePlayerSpeech(""); 
            textarea.value = "";
        };

        sendBtn.onclick = sendMessage;
        textarea.onkeydown = (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        };
    }

    private createAvatar(name: string, textureUrl: string, x: number, z: number): Mesh {
        const width = 1.0;
        const height = 1.5;
        const depth = 0.05;

        const faceUV = new Array(6).fill(new Vector4(0, 0, 0, 0));
        const vTrimStart = 0.02;
        const vTrimEnd = 0.98;
        faceUV[1] = new Vector4(1, vTrimEnd, 0, vTrimStart);

        const avatarMesh = MeshBuilder.CreateBox(name, { width, height, depth, faceUV }, this.scene);
        avatarMesh.position.set(x, height / 2, z);
        avatarMesh.rotation.y = Math.PI;

        const mat = new PBRMaterial(name + "_Mat", this.scene);
        const tex = new Texture(textureUrl, this.scene, false, false, Texture.TRILINEAR_SAMPLINGMODE);
        
        tex.hasAlpha = true;
        mat.albedoTexture = tex;
        mat.useAlphaFromAlbedoTexture = true;
        
        mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
        mat.alphaMode = Engine.ALPHA_COMBINE;
        mat.metallic = 0.0;
        mat.roughness = 0.02;   
        mat.backFaceCulling = false;

        avatarMesh.material = mat;
        return avatarMesh;
    }

    private createNameTag(targetMesh: Mesh, nameText: string): void {
        const namePlane = MeshBuilder.CreatePlane("nameTag_" + targetMesh.name, { width: 1.5, height: 0.40 }, this.scene);
        namePlane.billboardMode = Mesh.BILLBOARDMODE_ALL;
        namePlane.isPickable = false;
        
        namePlane.parent = targetMesh;
        namePlane.position = new Vector3(0, 0.95, 0);

        const adt = AdvancedDynamicTexture.CreateForMesh(namePlane, 600, 120);
        const textBlock = new TextBlock();
        textBlock.text = nameText;
        textBlock.color = "white";
        textBlock.fontSize = "24px";
        textBlock.fontWeight = "bold";
        textBlock.outlineWidth = 5;
        textBlock.outlineColor = "black";
        
        adt.addControl(textBlock);
    }

    private createObjects(): void {
        const ground = MeshBuilder.CreateGround("ground", { width: 100, height: 100 }, this.scene);
        const gridMaterial = new GridMaterial("gridMaterial", this.scene);
        gridMaterial.mainColor = new Color3(0.85, 0.95, 0.85);
        gridMaterial.lineColor = new Color3(0.35, 0.55, 0.35);
        gridMaterial.gridRatio = 1.0;
        gridMaterial.opacity = 1.0;
        ground.material = gridMaterial;

        this.hoverMarker = MeshBuilder.CreatePlane("hoverMarker", { size: 1.0 }, this.scene);
        this.hoverMarker.rotation.x = Math.PI / 2;
        this.hoverMarker.position.y = 0.01;
        const hoverMat = new StandardMaterial("hoverMat", this.scene);
        hoverMat.emissiveColor = new Color3(0.5, 1.0, 0.5); 
        hoverMat.alpha = 0.5; 
        hoverMat.disableLighting = true; 
        this.hoverMarker.material = hoverMat;
        this.hoverMarker.isPickable = false;

        this.clickMarker = MeshBuilder.CreatePlane("clickMarker", { size: 1.0 }, this.scene);
        this.clickMarker.rotation.x = Math.PI / 2;
        this.clickMarker.position.y = 0.01;
        const clickMat = new StandardMaterial("clickMat", this.scene);
        clickMat.emissiveColor = new Color3(0.0, 1.0, 0.0); 
        clickMat.alpha = 0.7;
        clickMat.disableLighting = true;
        this.clickMarker.material = clickMat;
        this.clickMarker.isVisible = false;
        this.clickMarker.isPickable = false;

        this.playerBox = this.createAvatar("tommie.jp", "/textures/pic1.ktx2", 0, 0);
        const player2 = this.createAvatar("npc001", "/textures/pic2.ktx2", 0, 3);
        const player3 = this.createAvatar("npc002", "/textures/pic2.ktx2", 1.5, 3);
        const player4 = this.createAvatar("npc003", "/textures/pic2.ktx2", 3, 3);

        this.createNameTag(this.playerBox, "tommie.jp✅️");
        this.createNameTag(player2, "npc001");
        this.createNameTag(player3, "npc002");
        this.createNameTag(player4, "npc003");

        this.createMinecraftClouds();
        this.createCoordinateLabels();
        
        this.updatePlayerSpeech = this.createSpeechBubble(this.playerBox, "こんにちは！");
        this.createSpeechBubble(player2, "キタちゃん１です。");
        this.createSpeechBubble(player3, "キタちゃん２です");
        this.createSpeechBubble(player4, "キタちゃん３です");

        this.createDebugOverlay();

        this.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
                const pick = this.scene.pick(
                    this.scene.pointerX, 
                    this.scene.pointerY, 
                    (mesh) => mesh.name === "ground"
                );

                if (pick && pick.hit && pick.pickedPoint) {
                    this.hoverMarker.position.x = Math.floor(pick.pickedPoint.x) + 0.5;
                    this.hoverMarker.position.z = Math.floor(pick.pickedPoint.z) + 0.5;
                    this.hoverMarker.isVisible = true;
                } else {
                    this.hoverMarker.isVisible = false;
                }
            }

            if (pointerInfo.type === PointerEventTypes.POINTERTAP) {
                const pick = pointerInfo.pickInfo;
                if (pick && pick.hit && pick.pickedMesh && pick.pickedMesh.name === "ground" && pick.pickedPoint) {
                    const snappedX = Math.floor(pick.pickedPoint.x) + 0.5;
                    const snappedZ = Math.floor(pick.pickedPoint.z) + 0.5;

                    this.targetPosition = new Vector3(snappedX, 0, snappedZ);
                    this.clickMarker.position.x = snappedX;
                    this.clickMarker.position.z = snappedZ;
                    this.clickMarker.isVisible = true;
                }
            }
        });

        this.scene.onBeforeRenderObservable.add(() => {
            if (this.targetPosition && this.playerBox) {
                const deltaTime = this.engine.getDeltaTime() / 1000;
                const currentPos = this.playerBox.position;
                const target = new Vector3(this.targetPosition.x, currentPos.y, this.targetPosition.z);
                const distance = Vector3.Distance(currentPos, target);
                const moveDist = this.moveSpeed * deltaTime;

                if (distance > moveDist) {
                    const direction = target.subtract(currentPos).normalize();
                    this.playerBox.position.addInPlace(direction.scale(moveDist));
                    this.playerBox.rotation.y = Math.atan2(direction.x, direction.z);
                } else {
                    this.playerBox.position.copyFrom(target);
                    this.targetPosition = null; 
                    this.clickMarker.isVisible = false; 
                }
            }
        });

        this.resetCameraScale();
    }

    private createSpeechBubble(targetMesh: Mesh, speechText: string): (newText: string) => void {
        const bubblePlane = MeshBuilder.CreatePlane("speechBubble_" + targetMesh.name, { width: 1.0, height: 0.20 }, this.scene);
        bubblePlane.billboardMode = Mesh.BILLBOARDMODE_ALL;
        bubblePlane.isPickable = false;
        
        bubblePlane.parent = targetMesh;
        bubblePlane.position = new Vector3(0, 1.2, 0); 
        
        const adt = AdvancedDynamicTexture.CreateForMesh(bubblePlane, 600, 100);
        
        const bg = new Rectangle();
        bg.width = "100%"; bg.height = "100%";
        bg.cornerRadius = 20;
        bg.background = "rgba(255, 255, 255, 0.85)";
        bg.thickness = 1;
        bg.color = "#333333";
        adt.addControl(bg);

        const textBlock = new TextBlock();
        textBlock.text = speechText;
        textBlock.fontSize = "24px";
        textBlock.color = "black";
        
        textBlock.textWrapping = true;
        textBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        textBlock.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        textBlock.paddingLeft = "10px";
        textBlock.paddingRight = "10px";
        textBlock.paddingTop = "10px";
        textBlock.paddingBottom = "10px";
        
        bg.addControl(textBlock);

        this.scene.onBeforeRenderObservable.add(() => {
            if (!textBlock.text || textBlock.text.trim() === "") {
                bubblePlane.isVisible = false;
            } else {
                bubblePlane.isVisible = true;
            }
        });
        
        return (newText: string) => {
            if (newText && newText.trim() !== "") {
                textBlock.text = newText;
                bubblePlane.isVisible = true;
            } else {
                textBlock.text = "";
                bubblePlane.isVisible = false;
            }
            adt.markAsDirty();
        };
    }

    private createMinecraftClouds(): void {
        for (let i = 0; i < 6; i++) {
            const cloudGroup = new TransformNode("cloudGroup" + i, this.scene);
            const baseX = (Math.random() - 0.5) * 140;
            const baseZ = (Math.random() - 0.5) * 140;
            const baseY = 18 + Math.random() * 12;
            const cloudMaterial = new StandardMaterial("cloudMat" + i, this.scene);
            cloudMaterial.diffuseColor = new Color3(0.9, 0.9, 0.95);
            cloudMaterial.alpha = 0.95;

            for (let j = 0; j < 5; j++) {
                const sphere = MeshBuilder.CreateSphere("cloudSphere" + i + "_" + j, { diameter: 5, segments: 8 }, this.scene);
                sphere.position.set(baseX + (Math.random() - 0.5) * 8, baseY + (Math.random() - 0.5) * 4, baseZ + (Math.random() - 0.5) * 8);
                sphere.scaling.set(1.4, 0.65, 1.1);
                sphere.material = cloudMaterial;
                sphere.parent = cloudGroup;
                sphere.isPickable = false;
            }
        }
    }

    private createCoordinateLabels(): void {
        const step = 10;
        const range = 50;
        for (let x = -range; x <= range; x += step) this.createSingleLabel(x, 0, "(" + x + ",0)");
        for (let z = -range; z <= range; z += step) if (z !== 0) this.createSingleLabel(0, z, "(0," + z + ")");
    }

    private createSingleLabel(x: number, z: number, labelText: string): void {
        const plane = MeshBuilder.CreatePlane("coordLabel_" + x + "_" + z, { width: 1.0, height: 1.0 }, this.scene);
        plane.rotation.x = Math.PI / 2;
        plane.position.set(x, 0.02, z);
        plane.isPickable = false;
        const texture = AdvancedDynamicTexture.CreateForMesh(plane);
        const bg = new Rectangle();
        bg.width = "100%"; bg.height = "100%";
        bg.background = "rgba(255,255,255,0.50)";
        bg.cornerRadius = 12;
        texture.addControl(bg);
        const text = new TextBlock();
        text.text = labelText; text.color = "#FF0000"; text.fontSize = "200px";
        bg.addControl(text);
    }

    private createDebugOverlay(): void {
        const adt = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        const panel = new Rectangle();
        
        panel.width = "260px"; 
        panel.height = "520px";
        panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        panel.top = "15px"; panel.left = "-15px";
        panel.background = "rgba(0, 0, 0, 0.7)";
        panel.cornerRadius = 8;
        adt.addControl(panel);

        const grid = new Grid();
        grid.addColumnDefinition(0.55); 
        grid.addColumnDefinition(0.45);
        
        const numRows = 19;
        for(let i = 0; i < numRows; i++) grid.addRowDefinition(1 / numRows);
        panel.addControl(grid);

        const createCell = (t: string, r: number, c: number, isl: boolean) => {
            const tb = new TextBlock();
            tb.text = t; 
            tb.color = isl ? "#AAAAAA" : (t.includes("ms") ? "#FFA500" : "#00FF00");
            tb.fontSize = 16; 
            tb.fontFamily = "Courier New, monospace";
            tb.textHorizontalAlignment = isl ? Control.HORIZONTAL_ALIGNMENT_LEFT : Control.HORIZONTAL_ALIGNMENT_RIGHT;
            tb.paddingLeft = isl ? "10px" : "0px"; 
            tb.paddingRight = isl ? "0px" : "10px";
            grid.addControl(tb, r, c);
            return tb;
        };

        createCell("Scale:", 0, 0, true);  
        createCell("Ver", 1, 0, true);
        createCell("FPS:", 2, 0, true); 
        createCell("CPU ms:", 3, 0, true);  
        createCell("GPU ms:", 4, 0, true);  
        createCell("DRAW:", 5, 0, true);
        createCell("MESH:", 6, 0, true); 
        createCell("Mats:", 7, 0, true);    
        createCell("Bones:", 8, 0, true);   
        createCell("JS RAM:", 9, 0, true);
        createCell("TexRAM:", 10, 0, true); 
        createCell("GeoRAM:", 11, 0, true); 
        createCell("Indices:", 12, 0, true); 
        createCell("Polys:", 13, 0, true);
        createCell("LOD:", 14, 0, true); 
        createCell("OcclQ:", 15, 0, true);
        createCell("FarClip:", 16, 0, true); 
        createCell("API:", 17, 0, true);
        createCell("AntiAliasing:", 18, 0, true);

        const scaleBtn = Button.CreateSimpleButton("scaleBtn", "1.0");
        scaleBtn.width = "60px";
        scaleBtn.height = "22px";
        scaleBtn.color = "#00FF00";
        scaleBtn.background = "rgba(50, 50, 50, 0.8)";
        scaleBtn.thickness = 1;
        scaleBtn.cornerRadius = 4;
        scaleBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        scaleBtn.paddingRight = "10px"; 
        
        if (scaleBtn.textBlock) {
            scaleBtn.textBlock.fontSize = 14;
            scaleBtn.textBlock.fontFamily = "Courier New, monospace";
        }
        grid.addControl(scaleBtn, 0, 1);

        // ★ ご要望の通り選択肢を更新
        const scaleLevels = [1.0, 2.0, 3.0, 0.5, 0.8];
        let currentScaleIdx = 0;

        scaleBtn.onPointerUpObservable.add(() => {
            currentScaleIdx = (currentScaleIdx + 1) % scaleLevels.length;
            const newScale = scaleLevels[currentScaleIdx];
            this.engine.setHardwareScalingLevel(newScale);
            
            if (scaleBtn.textBlock) {
                scaleBtn.textBlock.text = newScale.toFixed(1);
            }
        });

        createCell("0.08", 1, 1, false);
        const fv = createCell("0", 2, 1, false);
        const cv = createCell("0.0", 3, 1, false);
        const gv = createCell("0.0", 4, 1, false);
        const dv = createCell("0", 5, 1, false);
        const mv = createCell("0", 6, 1, false);
        const matv = createCell("0", 7, 1, false);
        const bv = createCell("0", 8, 1, false);
        const rv = createCell("0.0 MB", 9, 1, false);
        const tv = createCell("0.0 MB", 10, 1, false);
        const geov = createCell("0.0 MB", 11, 1, false);
        const iv = createCell("0", 12, 1, false);
        const pv = createCell("0", 13, 1, false);
        const lv = createCell("Off", 14, 1, false);
        const ov = createCell("0", 15, 1, false);
        const fcv = createCell("0", 16, 1, false);
        
        const isWebGPU = (this.engine as any).isWebGPU || this.engine.name === "WebGPU";
        createCell(isWebGPU ? "WebGPU" : "WebGL2", 17, 1, false);
        
        const aaBtn = Button.CreateSimpleButton("aaBtn", "Off");
        aaBtn.width = "60px";
        aaBtn.height = "22px";
        aaBtn.color = "#00FF00";
        aaBtn.background = "rgba(50, 50, 50, 0.8)";
        aaBtn.thickness = 1;
        aaBtn.cornerRadius = 4;
        aaBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        aaBtn.paddingRight = "10px"; 
        
        if (aaBtn.textBlock) {
            aaBtn.textBlock.fontSize = 14;
            aaBtn.textBlock.fontFamily = "Courier New, monospace";
        }
        grid.addControl(aaBtn, 18, 1); 

        let isAAEnabled = false;
        aaBtn.onPointerUpObservable.add(() => {
            isAAEnabled = !isAAEnabled;
            this.renderingPipeline.samples = isAAEnabled ? 4 : 1; 
            
            if (aaBtn.textBlock) {
                aaBtn.textBlock.text = isAAEnabled ? "On" : "Off";
                aaBtn.textBlock.color = isAAEnabled ? "#FFFFFF" : "#00FF00";
            }
            aaBtn.background = isAAEnabled ? "rgba(0, 120, 0, 0.8)" : "rgba(50, 50, 50, 0.8)";
        });

        const sceneInstrumentation = new SceneInstrumentation(this.scene);
        sceneInstrumentation.captureFrameTime = true;
        
        const engineInstrumentation = new EngineInstrumentation(this.engine);
        engineInstrumentation.captureGPUFrameTime = true;

        let frameCount = 0;
        let lastTexRAM = "0.0 MB";
        let lastGeoRAM = "0.0 MB";

        this.scene.onAfterRenderObservable.add(() => {
            frameCount++;
            
            if (frameCount % 10 !== 0) return;

            fv.text = this.engine.getFps().toFixed(0);
            
            if (sceneInstrumentation.frameTimeCounter) {
                cv.text = sceneInstrumentation.frameTimeCounter.lastSecAverage.toFixed(2);
            }
            
            if (engineInstrumentation.gpuFrameTimeCounter) {
                const gpuTime = engineInstrumentation.gpuFrameTimeCounter.lastSecAverage;
                gv.text = gpuTime > 0 ? gpuTime.toFixed(2) : "N/A"; 
            }

            if (sceneInstrumentation.drawCallsCounter) {
                dv.text = sceneInstrumentation.drawCallsCounter.current.toString();
            }
            
            const activeMeshes = this.scene.getActiveMeshes();
            mv.text = activeMeshes.length.toString();
            
            const activeMaterials = new Set();
            activeMeshes.forEach(m => { if(m.material) activeMaterials.add(m.material.name); });
            matv.text = activeMaterials.size.toString();

            let activeBones = 0;
            activeMeshes.forEach(m => { if(m.skeleton) activeBones += m.skeleton.bones.length; });
            bv.text = activeBones.toString();
            
            const mem = (performance as any).memory;
            if (mem) rv.text = (mem.usedJSHeapSize / (1024 * 1024)).toFixed(1) + " MB";

            if (frameCount % 60 === 0) { 
                let textureMemoryBytes = 0;
                this.scene.textures.forEach(texture => {
                    const size = texture.getSize();
                    if (size && size.width && size.height) {
                        const multiplier = texture.noMipmap ? 1.0 : 1.33;
                        textureMemoryBytes += size.width * size.height * 4 * multiplier;
                    }
                });
                lastTexRAM = (textureMemoryBytes / (1024 * 1024)).toFixed(1) + " MB";
                
                let geoMemoryBytes = 0;
                this.scene.meshes.forEach(m => {
                    geoMemoryBytes += m.getTotalVertices() * 32;
                    const indices = m.getIndices();
                    if (indices) geoMemoryBytes += indices.length * 4;
                });
                lastGeoRAM = (geoMemoryBytes / (1024 * 1024)).toFixed(1) + " MB";
            }
            tv.text = lastTexRAM;
            geov.text = lastGeoRAM;

            const activeIndices = this.scene.getActiveIndices();
            iv.text = activeIndices.toString();
            pv.text = Math.floor(activeIndices / 3).toString();

            const hasLOD = activeMeshes.data.some((m: any) => m.hasLODLevels);
            lv.text = hasLOD ? "Active" : "Off";

            const activeOcclusionQueries = this.scene.meshes.filter((m: any) => m.isOcclusionQueryInProgress).length;
            ov.text = activeOcclusionQueries.toString();

            if (this.camera) {
                fcv.text = this.camera.maxZ.toString();
            }
        });
    }

    private handleResize(): void {
        this.engine.resize(true);
        if (this.camera && this.playerBox) this.resetCameraScale();
    }

    private resetCameraScale(): void {
        const h = window.innerHeight || (this.engine.getRenderingCanvas() as HTMLCanvasElement).clientHeight;
        this.camera.setTarget(this.playerBox);
        this.camera.radius = Math.max(8, Math.min(30, h / 22));
        this.camera.rebuildAnglesAndRadius();
    }
}