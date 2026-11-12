        let scene, camera, renderer;
        let rubikGroup;
        let cubes = [];
        let isAnimating = false;
        const moveHistory = [];
        let historyIndex = 0;

        // Kontrol Kamera & Interaksi Mouse
        let isRightMouseDown = false;
        let mouseX = 0, mouseY = 0;
        let leftDragStart = null;
        let cameraAngleX = 0.65, cameraAngleY = 0.8;
        let cameraRadius = 7;

        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        // Standar Warna Asli
        const COLORS = {
            U: 0xffd700, // Kuning (Atas)
            D: 0xffffff, // Putih (Bawah)
            F: 0xdc2626, // Merah (Depan)
            B: 0xf97316, // Oranye (Belakang)
            R: 0x16a34a, // Hijau (Kanan)
            L: 0x2563eb, // Biru (Kiri)
            C: 0x111111  // Warna bagian dalam
        };

        // --- VARIABEL & STATE FITUR BARU ---
        let currentMode = 1; // 1 = Belajar, 2 = Mandiri
        let timerSeconds = 0;
        let timerInterval = null;
        let moveCount = 0;
        let isScrambled = false;
        let isScramblingMode = false;
        let hasStartedSolving = false;

        const guides = [
            { title: "Langkah 1: Bunga Daisy", desc: "Tujuan: Buat tanda '+' putih dengan pusat kuning di atas. Cari tepi (edge) putih dan putar ke layer atas sehingga mengelilingi center kuning." },
            { title: "Langkah 2: Cross Putih", desc: "Tujuan: Memindahkan tepi putih ke layer bawah. Cocokkan warna samping tepi putih dengan center sampingnya, lalu putar layer tersebut 180 derajat ke bawah." },
            { title: "Langkah 3: Sudut Putih (Layer 1)", desc: "Tujuan: Menyelesaikan seluruh sisi putih bawah. Cari sudut yang memiliki warna putih. Gunakan rumus R U R' U' berulang kali untuk memasukannya." },
            { title: "Langkah 4: Layer Kedua", desc: "Tujuan: Menyelesaikan sisi tengah. Cocokkan warna tepi tanpa kuning dengan center. Rumus Kanan: (U R U' R') (U' F' U F). Kiri: sebaliknya." },
            { title: "Langkah 5: Cross Kuning", desc: "Tujuan: Membuat tanda '+' kuning di atas. Jika ada bentuk 'L' kecil, posisikan di kiri atas. Gunakan rumus F (R U R' U') F'." },
            { title: "Langkah 6: Sisi Kuning Penuh", desc: "Tujuan: Menjadikan semua atap kuning. Posisikan satu sudut kuning di kiri bawah atap, gunakan rumus R U R' U R U2 R'." },
            { title: "Langkah 7: Posisi Sudut", desc: "Tujuan: Menyamakan 2 warna sudut di setiap sisi (headlights). Rumus: R U R' U' R' F R2 U' R' U' R U R' F'." },
            { title: "Langkah 8: Posisi Tepi Selesai", desc: "Tujuan: Menyelesaikan rubik! Gunakan rumus R U' R U R U R U' R' U' R2 untuk memutar 3 tepi terakhir ke tempat asalnya." }
        ];
        let currentGuideIndex = 0;
        // -----------------------------------

        init();
        animate();

        function init() {
            const container = document.getElementById('canvas-container');

            scene = new THREE.Scene();
            scene.background = new THREE.Color(0xf1f3f5);

            camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
            updateCameraPosition();

            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(container.clientWidth, container.clientHeight);
            renderer.setPixelRatio(window.devicePixelRatio);
            container.appendChild(renderer.domElement);

            scene.add(new THREE.AmbientLight(0xffffff, 0.7));
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(10, 20, 15);
            scene.add(directionalLight);

            createRubikCube();
            updateHistoryButtons();

            container.addEventListener('contextmenu', onContextMenu);
            container.addEventListener('mousedown', onMouseDown);
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
            window.addEventListener('resize', onWindowResize);
        }

        function createRubikCube() {
            rubikGroup = new THREE.Group();
            scene.add(rubikGroup);

            const size = 0.95;
            const geometry = new THREE.BoxGeometry(size, size, size);

            for (let x = -1; x <= 1; x++) {
                for (let y = -1; y <= 1; y++) {
                    for (let z = -1; z <= 1; z++) {
                        const materials = [
                            new THREE.MeshStandardMaterial({ color: x === 1 ? COLORS.R : COLORS.C }), // 0: Kanan
                            new THREE.MeshStandardMaterial({ color: x === -1 ? COLORS.L : COLORS.C }), // 1: Kiri
                            new THREE.MeshStandardMaterial({ color: y === 1 ? COLORS.U : COLORS.C }), // 2: Atas
                            new THREE.MeshStandardMaterial({ color: y === -1 ? COLORS.D : COLORS.C }), // 3: Bawah
                            new THREE.MeshStandardMaterial({ color: z === 1 ? COLORS.F : COLORS.C }), // 4: Depan
                            new THREE.MeshStandardMaterial({ color: z === -1 ? COLORS.B : COLORS.C })  // 5: Belakang
                        ];

                        const cube = new THREE.Mesh(geometry, materials);
                        cube.position.set(x, y, z);
                        rubikGroup.add(cube);
                        cubes.push(cube);
                    }
                }
            }
        }

        function onMouseDown(e) {
            if (e.button === 2) {
                isRightMouseDown = true;
                mouseX = e.clientX;
                mouseY = e.clientY;
            } else if (e.button === 0 && !isAnimating) {
                const hit = getCubeHit(e);
                leftDragStart = hit ? {
                    cube: hit.object,
                    normal: hit.face.normal.clone().transformDirection(hit.object.matrixWorld),
                    x: e.clientX,
                    y: e.clientY
                } : null;
            }
        }

        function onMouseMove(e) {
            if (!isRightMouseDown) return;

            const deltaX = e.clientX - mouseX;
            const deltaY = e.clientY - mouseY;
            cameraAngleY -= deltaX * 0.008;
            cameraAngleX -= deltaY * 0.008;
            cameraAngleX = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, cameraAngleX));

            mouseX = e.clientX;
            mouseY = e.clientY;
            updateCameraPosition();
        }

        function onMouseUp(e) {
            if (e.button === 2) isRightMouseDown = false;
            if (e.button === 0 && leftDragStart) {
                const drag = leftDragStart;
                leftDragStart = null;
                const dx = e.clientX - drag.x;
                const dy = e.clientY - drag.y;
                if (Math.hypot(dx, dy) >= 8) rotateFromDrag(drag, dx, dy);
            }
        }

        function onContextMenu(e) { e.preventDefault(); }

        function getCubeHit(e) {
            const container = document.getElementById('canvas-container');
            const rect = container.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            return raycaster.intersectObjects(cubes)[0] || null;
        }

        function rotateFromDrag(drag, dx, dy) {
            if (isAnimating) return;

            const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
            const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
            const swipe = cameraRight.multiplyScalar(dx).add(cameraUp.multiplyScalar(-dy));
            const normal = drag.normal;
            swipe.addScaledVector(normal, -swipe.dot(normal));
            if (swipe.lengthSq() < 0.001) return;
            swipe.normalize();

            const rotationAxis = new THREE.Vector3().crossVectors(normal, swipe);
            const axisNames = ['x', 'y', 'z'];
            let axisIndex = 0;
            if (Math.abs(rotationAxis.y) > Math.abs(rotationAxis.x)) axisIndex = 1;
            if (Math.abs(rotationAxis.z) > Math.abs(rotationAxis.getComponent(axisIndex))) axisIndex = 2;

            const axis = axisNames[axisIndex];
            const direction = Math.sign(rotationAxis.getComponent(axisIndex));
            if (!direction) return;
            const layer = Math.round(drag.cube.position[axis]);
            animateRotation(axis, layer, direction);
        }

        function updateCameraPosition() {
            camera.position.x = cameraRadius * Math.sin(cameraAngleY) * Math.cos(cameraAngleX);
            camera.position.y = cameraRadius * Math.sin(cameraAngleX);
            camera.position.z = cameraRadius * Math.cos(cameraAngleY) * Math.cos(cameraAngleX);
            camera.lookAt(0, 0, 0);
        }

        function resetCamera() {
            cameraAngleX = 0.65;
            cameraAngleY = 0.8;
            updateCameraPosition();
        }

        function rotateMove(moveType) {
            if (isAnimating) return;
            
            let axis, layer, direction;
            switch (moveType) {
                case 'R': axis = 'x'; layer = 1; direction = -1; break;
                case 'RPrime': axis = 'x'; layer = 1; direction = 1; break;
                case 'L': axis = 'x'; layer = -1; direction = 1; break;
                case 'LPrime': axis = 'x'; layer = -1; direction = -1; break;
                case 'U': axis = 'y'; layer = 1; direction = -1; break;
                case 'UPrime': axis = 'y'; layer = 1; direction = 1; break;
                case 'D': axis = 'y'; layer = -1; direction = 1; break;
                case 'DPrime': axis = 'y'; layer = -1; direction = -1; break;
                case 'F': axis = 'z'; layer = 1; direction = -1; break;
                case 'FPrime': axis = 'z'; layer = 1; direction = 1; break;
                case 'B': axis = 'z'; layer = -1; direction = 1; break;
                case 'BPrime': axis = 'z'; layer = -1; direction = -1; break;
            }

            if (axis) animateRotation(axis, layer, direction);
        }

        function undoMove() {
            if (isAnimating || historyIndex === 0) return;
            const move = moveHistory[historyIndex - 1];
            historyIndex--;
            updateHistoryButtons();
            animateRotation(move.axis, move.layer, -move.direction, false);
        }

        function redoMove() {
            if (isAnimating || historyIndex >= moveHistory.length) return;
            const move = moveHistory[historyIndex];
            historyIndex++;
            updateHistoryButtons();
            animateRotation(move.axis, move.layer, move.direction, false);
        }

        function updateHistoryButtons() {
            const buttons = document.querySelectorAll('.history-controls button');
            buttons[0].disabled = isAnimating || historyIndex === 0;
            buttons[1].disabled = isAnimating || historyIndex >= moveHistory.length;
        }

        function animateRotation(axis, layer, direction, recordHistory = true) {
            isAnimating = true;
            updateHistoryButtons();
            const targetRotation = (Math.PI / 2) * direction;
            let currentRotation = 0;
            const speed = 0.15;

            const affectedCubes = cubes.filter(cube => {
                const pos = Math.round(cube.position[axis]);
                return pos === layer;
            });

            const pivotGroup = new THREE.Group();
            scene.add(pivotGroup);
            affectedCubes.forEach(cube => pivotGroup.attach(cube));

            function step() {
                currentRotation += speed * direction;

                if ((direction > 0 && currentRotation >= targetRotation) || 
                    (direction < 0 && currentRotation <= targetRotation)) {
                    
                    const remainder = targetRotation - (currentRotation - speed * direction);
                    pivotGroup.rotation[axis] += remainder;

                    affectedCubes.forEach(cube => {
                        rubikGroup.attach(cube);
                        cube.position.round();
                    });

                    scene.remove(pivotGroup);
                    isAnimating = false;
                    
                    if (recordHistory) {
                        moveHistory.splice(historyIndex);
                        moveHistory.push({ axis, layer, direction });
                        historyIndex = moveHistory.length;
                    }
                    updateHistoryButtons();

                    // --- LOGIKA HOOK FITUR BARU: Menghitung move & Cek Solved ---
                    if (!isScramblingMode) {
                        if (currentMode === 2 && isScrambled && !hasStartedSolving) {
                            startTimer();
                        }
                        if (currentMode === 2 && isScrambled) {
                            moveCount++;
                            updateStatsUI();
                        }
                        
                        // Periksa kemenangan
                        if (isScrambled && checkIsSolved()) {
                            triggerWin();
                        }
                    }
                    // -----------------------------------------------------------
                    return;
                }

                pivotGroup.rotation[axis] += speed * direction;
                requestAnimationFrame(step);
            }

            requestAnimationFrame(step);
        }

        const possibleMoves = ['R', 'RPrime', 'L', 'LPrime', 'U', 'UPrime', 'D', 'DPrime', 'F', 'FPrime', 'B', 'BPrime'];
        
        // Memodifikasi scrambleCube sedikit untuk mengintegrasikan status scramble
        function scrambleCube() {
            if (isAnimating || isScramblingMode) return;
            
            isScramblingMode = true;
            isScrambled = false;
            resetTimer();
            moveCount = 0;
            updateStatsUI();

            let count = 0;
            const interval = setInterval(() => {
                if (isAnimating) return; // Mencegah tumpang tindih animasi

                const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
                rotateMove(randomMove);
                count++;
                
                if (count >= 15) { // 15 langkah acak
                    clearInterval(interval);
                    // Tunggu animasi terakhir selesai sebelum menandakan acakan selesai
                    const checkDone = setInterval(() => {
                        if (!isAnimating) {
                            clearInterval(checkDone);
                            isScramblingMode = false;
                            isScrambled = true;
                            hasStartedSolving = false; // Reset trigger start timer
                        }
                    }, 100);
                }
            }, 100);
        }

        function resetCube() {
            if (isAnimating) return;
            scene.remove(rubikGroup);
            cubes = [];
            moveHistory.length = 0;
            historyIndex = 0;
            createRubikCube();
            updateHistoryButtons();
            
            // Reset fitur mode 2
            isScrambled = false;
            resetTimer();
            moveCount = 0;
            updateStatsUI();
        }

        function onWindowResize() {
            const container = document.getElementById('canvas-container');
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }

        function animate() {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        }

        /* ================== FUNGSI FITUR BARU (MODE, TIMER, WIN) ================== */
        
        function setMode(mode) {
            currentMode = mode;
            document.getElementById('btn-mode-1').classList.toggle('active', mode === 1);
            document.getElementById('btn-mode-2').classList.toggle('active', mode === 2);
            document.getElementById('panel-mode-1').style.display = mode === 1 ? 'block' : 'none';
            document.getElementById('panel-mode-2').style.display = mode === 2 ? 'block' : 'none';
        }

        function updateGuideUI() {
            document.getElementById('guide-title').innerText = guides[currentGuideIndex].title;
            document.getElementById('guide-desc').innerText = guides[currentGuideIndex].desc;
        }

        function nextGuide() {
            if (currentGuideIndex < guides.length - 1) {
                currentGuideIndex++;
                updateGuideUI();
            }
        }

        function prevGuide() {
            if (currentGuideIndex > 0) {
                currentGuideIndex--;
                updateGuideUI();
            }
        }

        function startTimer() {
            if (timerInterval) clearInterval(timerInterval);
            hasStartedSolving = true;
            timerInterval = setInterval(() => {
                timerSeconds++;
                updateStatsUI();
            }, 1000);
        }

        function resetTimer() {
            if (timerInterval) clearInterval(timerInterval);
            timerSeconds = 0;
            hasStartedSolving = false;
            updateStatsUI();
        }

        function updateStatsUI() {
            const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
            const s = (timerSeconds % 60).toString().padStart(2, '0');
            document.getElementById('timer-display').innerText = `${m}:${s}`;
            document.getElementById('move-counter').innerText = moveCount;
        }

        function formatTime(secs) {
            const m = Math.floor(secs / 60).toString().padStart(2, '0');
            const s = (secs % 60).toString().padStart(2, '0');
            return `${m}:${s}`;
        }

        function triggerWin() {
            if (timerInterval) clearInterval(timerInterval);
            isScrambled = false; // Hindari trigger berkali-kali
            
            // Set statistik ke modal
            if (currentMode === 2) {
                document.getElementById('win-stats-container').style.display = 'block';
                document.getElementById('win-time').innerText = formatTime(timerSeconds);
                document.getElementById('win-steps').innerText = moveCount;
            } else {
                document.getElementById('win-stats-container').style.display = 'none';
            }
            
            // Munculkan Modal Kemenangan
            document.getElementById('win-modal').style.display = 'flex';
        }

        function closeWinModal() {
            document.getElementById('win-modal').style.display = 'none';
            resetCube();
        }

        // ALGORITMA PENGECEKAN RUBIK SELESAI
        function checkIsSolved() {
            // Sisi dan arah hadap dunia yang diharapkan (World Axis)
            const checks = [
                { axis: 'x', val: 1, expectedColor: COLORS.R, worldVec: new THREE.Vector3(1,0,0) },
                { axis: 'x', val: -1, expectedColor: COLORS.L, worldVec: new THREE.Vector3(-1,0,0) },
                { axis: 'y', val: 1, expectedColor: COLORS.U, worldVec: new THREE.Vector3(0,1,0) },
                { axis: 'y', val: -1, expectedColor: COLORS.D, worldVec: new THREE.Vector3(0,-1,0) },
                { axis: 'z', val: 1, expectedColor: COLORS.F, worldVec: new THREE.Vector3(0,0,1) },
                { axis: 'z', val: -1, expectedColor: COLORS.B, worldVec: new THREE.Vector3(0,0,-1) },
            ];

            // 6 Axis lokal dari tiap kotak (sesuai urutan material dari geometry)
            const localAxes = [
                new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0),
                new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0),
                new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1)
            ];

            // Cek setiap sisi
            for (let check of checks) {
                // Cari ke-9 kotak yang berada pada sisi dunia tersebut (misal y=1 untuk layer atas)
                const faceCubes = cubes.filter(c => Math.round(c.position[check.axis]) === check.val);
                if (faceCubes.length !== 9) return false;

                // Periksa orientasi warna pada ke-9 kotak tersebut
                for (let cube of faceCubes) {
                    let matchedColor = null;
                    for (let i = 0; i < 6; i++) {
                        const rotatedAxis = localAxes[i].clone().applyQuaternion(cube.quaternion);
                        rotatedAxis.x = Math.round(rotatedAxis.x);
                        rotatedAxis.y = Math.round(rotatedAxis.y);
                        rotatedAxis.z = Math.round(rotatedAxis.z);
                        
                        // Jika axis lokal menunjuk ke arah axis dunia, catat warna materialnya
                        if (rotatedAxis.equals(check.worldVec)) {
                            matchedColor = cube.material[i].color.getHex();
                            break;
                        }
                    }
                    // Jika satu stiker saja warnanya tidak sesuai, berarti belum selesai
                    if (matchedColor !== check.expectedColor) {
                        return false;
                    }
                }
            }
            return true; // Semua sesuai!
        }
