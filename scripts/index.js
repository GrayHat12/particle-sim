const PIXEL_PER_FEMT = 1 / 0.8;
const TIME_SCALE = 1e-2;
const FORCE_SCALE = 1e45;
const SPACE_SCALE = PIXEL_PER_FEMT * 1e15;
const MASS_SCALE = 1;//1e24;
const CHARGE_SCALE = 1;//1e9;

const ELASTICITY = 0.1; // For perfectly elastic: e = 1.0. For inelastic: e < 1.0

const ATOM_SIZE = PIXEL_PER_FEMT * 50;

const BINDING_DISTANCE = 1e-15 * SPACE_SCALE;
const BINDING_DISTANCE_REVERSE = 0.5e-15 * SPACE_SCALE;

const GCONST = 6.674 * (1e-11 * FORCE_SCALE / (SPACE_SCALE ** 3));
// Coulomb's Constant (k), scaled similarly to your GCONST
const KCONST = 8.987 * (1e9 * FORCE_SCALE / (SPACE_SCALE ** 3)); // 9 + 45 - 45

let GlobalIdCounter = 0;

const NEUTRON_COLOR = "#FFFFFF80";
const PROTON_COLOR = "#FF313180";
const ELECTRON_COLOR = "#00D4FF6A";
const ATTRACTION_COLOR = "#39FF14";
const REPULSION_COLOR = "#ff0000";
const NOTHING_COLOR = "#ffffff";

const OFFSET = 0;

/**
 * 
 * @param {() => number} seededRandomGenerator 
 * @param {number} min 
 * @param {number} max 
 */
function getRandomInclusiveSeeded(seededRandomGenerator, min, max) {
    return seededRandomGenerator() * (max - min) + min;
}

/**
 * @typedef {{x: number; y: number}} Position
 * @typedef {{x: number; y: number}} Velocity
 */

function getWindowWidth() {
    // let minimum = Math.min(windowWidth, windowHeight);
    // return minimum - OFFSET * 2;
    return windowWidth;
}

function getWindowHeight() {
    // return getWindowWidth();
    return windowHeight;
}

class Particle {
    id;
    friction = 1 - 1e-5;
    /**
     * @type {string}
     */
    type;
    /**
     * @type {number}
     */
    mass;
    /**
     * @type {number}
     */
    radius;

    /**
     * @type {Position}
     */
    position;

    /**
     * @type {Velocity}
     */
    velocity = { x: 0, y: 0 };

    charge = 0;

    constructor() {
        this.id = GlobalIdCounter++;
        let isInValid = true;
        let position = {
            x: getRandomInclusiveSeeded(Math.random, 0, getWindowWidth()),
            y: getRandomInclusiveSeeded(Math.random, 0, getWindowHeight())
        };
        while (isInValid) {
            position = {
                x: getRandomInclusiveSeeded(Math.random, 0, getWindowWidth()),
                y: getRandomInclusiveSeeded(Math.random, 0, getWindowHeight())
            };
            isInValid = false;
            for (let particle of Particles) {
                if (getDistance(position, particle.position, getWindowWidth(), getWindowHeight()).d <= (2.8179 * (1e-15 * SPACE_SCALE) + particle.radius)) {
                    isInValid = true;
                    break;
                }
            }
        }
        this.position = position;
        this.velocity = {
            x: getRandomInclusiveSeeded(Math.random, -0, 0),
            y: getRandomInclusiveSeeded(Math.random, -0, 0)
        };
    }

    applyForces = () => {
        let highest = null;
        let lowest = null;
        for (let particle of Particles) {
            if (particle === this) continue;

            let { force, magnitude } = this.forceFromParticle(particle);

            if (highest == null) {
                highest = { magnitude, position: particle.position, id: particle.id };
            } else if (highest.magnitude < magnitude) {
                highest.magnitude = magnitude;
                highest.position = particle.position;
                highest.id = particle.id;
            }
            if (lowest == null) {
                lowest = { magnitude, position: particle.position, id: particle.id };
            } else if (lowest.magnitude > magnitude) {
                lowest.magnitude = magnitude;
                lowest.position = particle.position;
                lowest.id = particle.id;
            }

            this.velocity.x += (force.x * deltaTime * TIME_SCALE / 1e3) / this.mass;
            this.velocity.y += (force.y * deltaTime * TIME_SCALE / 1e3) / this.mass;
        }

        for (let item of [highest, lowest]) {
            if (item == null) continue;
            if (!completedLines.has(`${this.id}-${item.id}`) && Math.abs(this.position.x - item.position.x) < ATOM_SIZE && Math.abs(this.position.y - item.position.y) < ATOM_SIZE) {
                strokeWeight(0.1);
                if (item.magnitude > 0) {
                    stroke(ATTRACTION_COLOR)
                } else if (item.magnitude < 0) {
                    stroke(REPULSION_COLOR)
                } else {
                    stroke(NOTHING_COLOR)
                }
                line(this.position.x + OFFSET, this.position.y + OFFSET, item.position.x + OFFSET, item.position.y + OFFSET);
                completedLines.add(`${this.id}-${item.id}`);
                completedLines.add(`${item.id}-${this.id}`);
            }
        }
    }

    /**
     * 
     * @param {Particle} particle 
     * @returns {{force: Velocity, magnitude: number}}
     */
    forceFromParticle = (particle) => {
        throw Error("TO be implemented");
    }

    move = () => {
        this.position.x = (this.position.x + this.velocity.x + getWindowWidth()) % getWindowWidth();
        this.position.y = (this.position.y + this.velocity.y + getWindowHeight()) % getWindowHeight();
        this.velocity.x *= (this.friction ** (deltaTime * TIME_SCALE / 1e3));
        this.velocity.y *= (this.friction ** (deltaTime * TIME_SCALE / 1e3));
    }
}

/**
 * 
 * @param {Position} positiona 
 * @param {Position} positionb 
 * @param {number} worldWidth 
 * @param {number} worldHeight 
 */
function getDistance(positiona, positionb, worldWidth, worldHeight) {
    let dx = positionb.x - positiona.x;
    let dy = positionb.y - positiona.y;

    // Wrap X coordinate
    if (dx > worldWidth / 2) {
        dx -= worldWidth;
    } else if (dx < -worldWidth / 2) {
        dx += worldWidth;
    }

    // Wrap Y coordinate
    if (dy > worldHeight / 2) {
        dy -= worldHeight;
    } else if (dy < -worldHeight / 2) {
        dy += worldHeight;
    }

    return {
        dx: dx,
        dy: dy,
        d: Math.sqrt(dx * dx + dy * dy)
    };
}

/**
 * 
 * @param {Particle} particlea 
 * @param {Particle} particleb 
 * @param {number?} [radius=null] 
 */
function calculateGravitationalForce(particlea, particleb, radius = null) {
    if (typeof radius !== "number") {
        radius = getDistance(particlea.position, particleb.position, getWindowWidth(), getWindowHeight());
    }
    return GCONST * particlea.mass * particleb.mass / (radius ** 2);
}

/**
 * 
 * @param {Particle} particlea 
 * @param {Particle} particleb 
 * @param {number?} [radius=null] 
 */
function calculateElectromagneticForce(particlea, particleb, radius = null) {
    if (typeof radius !== "number") {
        radius = getDistance(particlea.position, particleb.position, getWindowWidth(), getWindowHeight());
    }
    return (KCONST * particlea.charge * particleb.charge) / (radius ** 2);
}

/**
 * @type {Array<Particle>}
 */
const Particles = new Array();

class Neutron extends Particle {
    type = "neutron";
    mass = 1.6749 * (1e-27 * MASS_SCALE);
    radius = getRandomInclusiveSeeded(Math.random, 0.8, 1.2) * (1e-15 * SPACE_SCALE);
    charge = 0;

    __applyForces = () => {
        for (let particle of Particles) {
            if (particle === this) continue;

            let distData = getDistance(this.position, particle.position, getWindowWidth(), getWindowHeight());
            let r = distData.d;

            // if (r <= 0) r = 0.001;

            let minDistance = this.radius + particle.radius;
            if (r < minDistance) {
                this.velocity.x *= -0.5;
                this.velocity.y *= -0.5;
                continue; // Skip force calculation for this frame
                r = minDistance;
                if (Math.abs(distData.dx) < minDistance) {
                    distData.dx = distData.dx < 0 ? minDistance : -minDistance;
                }
                if (Math.abs(distData.dy) < minDistance) {
                    distData.dy = distData.dy < 0 ? minDistance : -minDistance;
                }
            }

            let bindingForce = 0;

            if (particle.type != "electron" && r <= PIXEL_PER_FEMT) {
                bindingForce = calculateElectromagneticForce(particle, particle, r) * 1e2;
                if (r <= (PIXEL_PER_FEMT / 2)) {
                    bindingForce = -bindingForce;
                }
            }

            let fg = calculateGravitationalForce(this, particle, r);

            let totalForceMag = fg + bindingForce;

            let fx = totalForceMag * (distData.dx / r);
            let fy = totalForceMag * (distData.dy / r);

            // if (!completedLines.has(`${this.id}-${particle.id}`) && r < ATOM_SIZE && Math.abs(this.position.x - particle.position.x) < ATOM_SIZE && Math.abs(this.position.y - particle.position.y) < ATOM_SIZE) {
            //     strokeWeight(0.1);
            //     if (totalForceMag > 0) {
            //         stroke(ATTRACTION_COLOR)
            //     velocity.y} else if (totalForceMag < 0) {
            //         stroke(REPULSION_COLOR)
            //     } else {
            //         stroke(NOTHING_COLOR)
            //     }
            //     line(this.position.x, this.position.y, particle.position.x, particle.position.y);
            //     completedLines.add(`${this.id}-${particle.id}`);
            //     completedLines.add(`${particle.id}-${this.id}`);
            // }

            this.velocity.x += (fx * deltaTime * TIME_SCALE / 1e3) / this.mass;
            this.velocity.y += (fy * deltaTime * TIME_SCALE / 1e3) / this.mass;
        }
    }

    /**
     * 
     * @param {Particle} particle 
     * @returns 
     */
    forceFromParticle = (particle) => {
        let distData = getDistance(this.position, particle.position, getWindowWidth(), getWindowHeight());
        let r = distData.d;

        // if (r <= 0) r = 0.001;

        let minDistance = this.radius + particle.radius;
        if (r < minDistance) {
            let nx = distData.dx / distData.d;
            let ny = distData.dy / distData.d;

            let relativeVx = this.velocity.x - particle.velocity.x;
            let relativeVy = this.velocity.y - particle.velocity.y;
            let velocityAlongNormal = relativeVx * nx + relativeVy * ny;

            if (velocityAlongNormal >= 0) {
                let j = -(1 + ELASTICITY) * velocityAlongNormal;
                j /= (1 / this.mass + 1 / particle.mass);

                let impulseX = j * nx;
                let impulseY = j * ny;

                this.velocity.x += impulseX / this.mass;
                this.velocity.y += impulseY / this.mass;
                particle.velocity.x -= impulseX / particle.mass;
                particle.velocity.y -= impulseY / particle.mass;
            };

            // let tx = -ny;
            // let ty = nx;

            // let v1n = this.velocity.x * nx + this.velocity.y * ny;
            // let v1t = this.velocity.x * tx + this.velocity.y * ty;
            // let v2n = particle.velocity.x * nx + particle.velocity.y * ny;
            // let v2t = particle.velocity.x * tx + particle.velocity.y * ty;

            // let v1n_after = (v1n * (this.mass - particle.mass) + 2 * particle.mass * v2n) / (this.mass + particle.mass);
            // let v2n_after = (v2n * (particle.mass - this.mass) + 2 * this.mass * v1n) / (this.mass + particle.mass);

            // this.velocity.x = v1n_after * nx + v1t * tx;
            // this.velocity.y = v1n_after * ny + v1t * ty;
            // particle.velocity.x = v2n_after * nx + v2t * tx;
            // particle.velocity.y = v2n_after * ny + v2t * ty;

            // return { force: { x: 0, y: 0 }, magnitude: 0 };
        }

        let bindingForce = 0;

        if (particle.type != "electron" && r <= (minDistance + PIXEL_PER_FEMT)) {
            bindingForce = calculateElectromagneticForce(particle, particle, r) * 1e2;
            if (r <= ((minDistance + PIXEL_PER_FEMT / 2))) {
                // console.log("applying reverse binding force");
                // bindingForce = -bindingForce;
            } else {
                // console.log("applying binding force");
            }
        }

        let fg = calculateGravitationalForce(this, particle, r);

        let totalForceMag = fg + bindingForce;

        let fx = totalForceMag * (distData.dx / r);
        let fy = totalForceMag * (distData.dy / r);

        return { force: { x: fx, y: fy }, magnitude: totalForceMag };
    }
}

let completedLines = new Set();

class Electron extends Particle {
    type = "electron";
    mass = 9.1093 * (1e-31 * MASS_SCALE);
    radius = 2.8179 * (1e-15 * SPACE_SCALE);
    charge = -1.6021 * (1e-19 * CHARGE_SCALE);

    __applyForces = () => {
        for (let particle of Particles) {
            if (particle === this) continue;

            let distData = getDistance(this.position, particle.position, getWindowWidth(), getWindowHeight());
            let r = distData.d;

            // if (r < 1) r = 0.5;
            let minDistance = this.radius + particle.radius;
            if (r < minDistance) {
                this.velocity.x *= -0.5;
                this.velocity.y *= -0.5;
                continue; // Skip force calculation for this frame
                r = minDistance;
                if (Math.abs(distData.dx) < minDistance) {
                    distData.dx = distData.dx < 0 ? minDistance : -minDistance;
                }
                if (Math.abs(distData.dy) < minDistance) {
                    distData.dy = distData.dy < 0 ? minDistance : -minDistance;
                }
            }

            let fg = calculateGravitationalForce(this, particle, r);
            let fe = calculateElectromagneticForce(this, particle, r);

            let totalForceMag = fg - fe;

            let fx = totalForceMag * (distData.dx / r);
            let fy = totalForceMag * (distData.dy / r);

            if (particle.type !== "neutron" && !completedLines.has(`${this.id}-${particle.id}`) && r < ATOM_SIZE && Math.abs(this.position.x - particle.position.x) < ATOM_SIZE && Math.abs(this.position.y - particle.position.y) < ATOM_SIZE) {
                strokeWeight(0.1);
                if (totalForceMag > 0) {
                    stroke(ATTRACTION_COLOR)
                } else if (totalForceMag < 0) {
                    stroke(REPULSION_COLOR)
                } else {
                    stroke(NOTHING_COLOR)
                }
                line(this.position.x, this.position.y, particle.position.x, particle.position.y);
                completedLines.add(`${this.id}-${particle.id}`);
                completedLines.add(`${particle.id}-${this.id}`);
            }

            this.velocity.x += (fx * deltaTime * TIME_SCALE / 1e3) / this.mass;
            this.velocity.y += (fy * deltaTime * TIME_SCALE / 1e3) / this.mass;
        }
    }

    /**
     * 
     * @param {Particle} particle 
     * @returns 
     */
    forceFromParticle = (particle) => {
        let distData = getDistance(this.position, particle.position, getWindowWidth(), getWindowHeight());
        let r = distData.d;

        // if (r < 1) r = 0.5;
        let minDistance = this.radius + particle.radius;
        if (r < minDistance) {
            // let ftx = this.mass * this.velocity.x * (distData.dx / r);
            // let fty = this.mass * this.velocity.y * (distData.dy / r);

            // let fpx = particle.mass * particle.velocity.x * (distData.dx / r);
            // let fpy = particle.mass * particle.velocity.y * (distData.dy / r);

            // this.velocity.x += fpx;
            // this.velocity.y += fpy;

            // particle.velocity.x += ftx;
            // particle.velocity.y += fty;
            let nx = distData.dx / distData.d;
            let ny = distData.dy / distData.d;

            let relativeVx = this.velocity.x - particle.velocity.x;
            let relativeVy = this.velocity.y - particle.velocity.y;
            let velocityAlongNormal = relativeVx * nx + relativeVy * ny;

            if (velocityAlongNormal >= 0) {
                let j = -(1 + ELASTICITY) * velocityAlongNormal;
                j /= (1 / this.mass + 1 / particle.mass);

                let impulseX = j * nx;
                let impulseY = j * ny;

                this.velocity.x += impulseX / this.mass;
                this.velocity.y += impulseY / this.mass;
                particle.velocity.x -= impulseX / particle.mass;
                particle.velocity.y -= impulseY / particle.mass;
            };

            // let tx = -ny;
            // let ty = nx;

            // let v1n = this.velocity.x * nx + this.velocity.y * ny;
            // let v1t = this.velocity.x * tx + this.velocity.y * ty;
            // let v2n = particle.velocity.x * nx + particle.velocity.y * ny;
            // let v2t = particle.velocity.x * tx + particle.velocity.y * ty;

            // let v1n_after = (v1n * (this.mass - particle.mass) + 2 * particle.mass * v2n) / (this.mass + particle.mass);
            // let v2n_after = (v2n * (particle.mass - this.mass) + 2 * this.mass * v1n) / (this.mass + particle.mass);

            // this.velocity.x = v1n_after * nx + v1t * tx;
            // this.velocity.y = v1n_after * ny + v1t * ty;
            // particle.velocity.x = v2n_after * nx + v2t * tx;
            // particle.velocity.y = v2n_after * ny + v2t * ty;
            // return { force: { x: 0, y: 0 }, magnitude: 0 };
        }

        let fg = calculateGravitationalForce(this, particle, r);
        let fe = calculateElectromagneticForce(this, particle, r);

        // this.fg = fg;
        // this.fe = fe;

        // console.log({ fg, fe });

        let totalForceMag = fg - fe;

        let fx = totalForceMag * (distData.dx / r);
        let fy = totalForceMag * (distData.dy / r);

        return { force: { x: fx, y: fy }, magnitude: totalForceMag };
    }
}

class Proton extends Particle {
    type = "proton";
    mass = 1.6726 * (1e-27 * MASS_SCALE);
    radius = getRandomInclusiveSeeded(Math.random, 0.84, 0.88) * (1e-15 * SPACE_SCALE);
    charge = 1.6021 * (1e-19 * CHARGE_SCALE);

    __applyForces = () => {
        for (let particle of Particles) {
            if (particle === this) continue;

            let distData = getDistance(this.position, particle.position, getWindowWidth(), getWindowHeight());
            let r = distData.d;

            // if (r < 1) r = 0.5;
            let minDistance = this.radius + particle.radius;
            if (r < minDistance) {
                this.velocity.x *= -0.5;
                this.velocity.y *= -0.5;

                particle.velocity.x = this.velocity.x;
                particle.velocity.y = this.velocity.y;
                continue; // Skip force calculation for this frame
                r = minDistance;
                if (Math.abs(distData.dx) < minDistance) {
                    distData.dx = distData.dx < 0 ? minDistance : -minDistance;
                }
                if (Math.abs(distData.dy) < minDistance) {
                    distData.dy = distData.dy < 0 ? minDistance : -minDistance;
                }
            }

            let bindingForce = 0;

            if (particle.type != "electron" && r <= PIXEL_PER_FEMT) {
                bindingForce = calculateElectromagneticForce(particle, particle, r) * 1e2;
                if (r <= (PIXEL_PER_FEMT / 2)) {
                    bindingForce = -bindingForce;
                }
            }

            let fg = calculateGravitationalForce(this, particle, r);
            let fe = calculateElectromagneticForce(this, particle, r);

            let totalForceMag = fg - fe + bindingForce;

            let fx = totalForceMag * (distData.dx / r);
            let fy = totalForceMag * (distData.dy / r);

            if (particle.type !== "neutron" && !completedLines.has(`${this.id}-${particle.id}`) && r < ATOM_SIZE && Math.abs(this.position.x - particle.position.x) < ATOM_SIZE && Math.abs(this.position.y - particle.position.y) < ATOM_SIZE) {
                strokeWeight(0.1);
                if (totalForceMag > 0) {
                    stroke(ATTRACTION_COLOR)
                } else if (totalForceMag < 0) {
                    stroke(REPULSION_COLOR)
                } else {
                    stroke(NOTHING_COLOR)
                }
                line(this.position.x, this.position.y, particle.position.x, particle.position.y);
                completedLines.add(`${this.id}-${particle.id}`);
                completedLines.add(`${particle.id}-${this.id}`);
            }

            this.velocity.x += (fx * deltaTime * TIME_SCALE / 1e3) / this.mass;
            this.velocity.y += (fy * deltaTime * TIME_SCALE / 1e3) / this.mass;
        }
    }

    /**
     * 
     * @param {Particle} particle 
     * @returns 
     */
    forceFromParticle = (particle) => {
        let distData = getDistance(this.position, particle.position, getWindowWidth(), getWindowHeight());
        let r = distData.d;

        // if (r < 1) r = 0.5;
        let minDistance = this.radius + particle.radius;
        if (r < minDistance) {
            // let ftx = this.mass * this.velocity.x * (distData.dx / r);
            // let fty = this.mass * this.velocity.y * (distData.dy / r);

            // this.velocity.x += (ftx * -0.5);
            // this.velocity.y += (fty * -0.5);

            // particle.velocity.x += (ftx * 0.5);
            // particle.velocity.y += (fty * 0.5);

            // let ftx = this.mass * this.velocity.x * (distData.dx / r);
            // let fty = this.mass * this.velocity.y * (distData.dy / r);

            // let fpx = particle.mass * particle.velocity.x * (distData.dx / r);
            // let fpy = particle.mass * particle.velocity.y * (distData.dy / r);

            // this.velocity.x += fpx;
            // this.velocity.y += fpy;

            // particle.velocity.x += ftx;
            // particle.velocity.y += fty;

            let nx = distData.dx / distData.d;
            let ny = distData.dy / distData.d;

            // let tx = -ny;
            // let ty = nx;

            // let v1n = this.velocity.x * nx + this.velocity.y * ny;
            // let v1t = this.velocity.x * tx + this.velocity.y * ty;
            // let v2n = particle.velocity.x * nx + particle.velocity.y * ny;
            // let v2t = particle.velocity.x * tx + particle.velocity.y * ty;

            // let v1n_after = (v1n * (this.mass - particle.mass) + 2 * particle.mass * v2n) / (this.mass + particle.mass);
            // let v2n_after = (v2n * (particle.mass - this.mass) + 2 * this.mass * v1n) / (this.mass + particle.mass);

            // this.velocity.x = v1n_after * nx + v1t * tx;
            // this.velocity.y = v1n_after * ny + v1t * ty;
            // particle.velocity.x = v2n_after * nx + v2t * tx;
            // particle.velocity.y = v2n_after * ny + v2t * ty;

            let relativeVx = this.velocity.x - particle.velocity.x;
            let relativeVy = this.velocity.y - particle.velocity.y;
            let velocityAlongNormal = relativeVx * nx + relativeVy * ny;

            if (velocityAlongNormal >= 0) {
                let j = -(1 + ELASTICITY) * velocityAlongNormal;
                j /= (1 / this.mass + 1 / particle.mass);

                let impulseX = j * nx;
                let impulseY = j * ny;

                this.velocity.x += impulseX / this.mass;
                this.velocity.y += impulseY / this.mass;
                particle.velocity.x -= impulseX / particle.mass;
                particle.velocity.y -= impulseY / particle.mass;
            };

            // if (this.id == 0) console.log(JSON.parse(JSON.stringify({ "this": this, particle, distData, minDistance, ftx, fty })));

            // return { force: { x: 0, y: 0 }, magnitude: 0 };
        }

        let bindingForce = 0;

        if (particle.type == "neutron" && r <= (minDistance + PIXEL_PER_FEMT)) {
            bindingForce = calculateElectromagneticForce(particle, particle, r) * 1e3;
            if (r <= ((minDistance + PIXEL_PER_FEMT / 2))) {
                bindingForce = -bindingForce;
            }
        }

        let fg = calculateGravitationalForce(this, particle, r);
        let fe = calculateElectromagneticForce(this, particle, r);

        let totalForceMag = fg - fe + bindingForce;

        let fx = totalForceMag * (distData.dx / r);
        let fy = totalForceMag * (distData.dy / r);

        // if (this.id == 0) console.log(JSON.parse(JSON.stringify({ "this": this, particle, totalForceMag, fx, fy, fg, fe, bindingForce })));

        return { force: { x: fx, y: fy }, magnitude: totalForceMag };
    }
}

function preload() {
    console.log("preload");
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    frameRate(90);
    background("#323232");
    let protonCount = 256;
    let neutronCount = protonCount * 1;
    let electronCount = neutronCount * 2;
    for (let i = 0; i < protonCount; i++) {
        Particles.push(new Proton());
    }
    for (let i = 0; i < neutronCount; i++) {
        Particles.push(new Neutron());
    }
    for (let i = 0; i < electronCount; i++) {
        Particles.push(new Electron());
    }
}

function renderFPS() {
    fill("#ffffff");
    stroke("#ffffff");
    rect(0, 0, 100, 50);
    fill("#000000");
    noStroke();
    text("FPS: " + frameRate().toFixed(2), 10, 30);
}

function draw() {
    // background(`#00000033`);
    fill("#00000033");
    rect(0 + OFFSET, 0 + OFFSET, getWindowWidth(), getWindowHeight());
    completedLines.clear();
    // clear();
    // background(`#000000`)

    // draw particles
    for (let particle of Particles) {
        particle.applyForces();
        particle.move();

        if (particle.type == "electron") {
            fill(ELECTRON_COLOR);
            noStroke();
            circle(particle.position.x + OFFSET, particle.position.y + OFFSET, particle.radius);
        } else if (particle.type == "proton") {
            fill(PROTON_COLOR);
            noStroke();
            circle(particle.position.x + OFFSET, particle.position.y + OFFSET, particle.radius);
        } else if (particle.type == "neutron") {
            fill(NEUTRON_COLOR);
            noStroke();
            circle(particle.position.x + OFFSET, particle.position.y + OFFSET, particle.radius);
        }
    }

    renderFPS();
}