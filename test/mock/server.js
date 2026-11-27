// ตัวแทนของ @minecraft/server สำหรับเทสต์ด้วย Node ทำเฉพาะส่วนที่โค้ดของแอดออนเรียกจริง
// พฤติกรรมที่เลียนแบบมาจากผลบนเอนจินจริง (ดู 02-ตรวจสอบและการตัดสินใจ.md ข้อ P8–P13)

export class MolangVariableMap {
  constructor() {
    this.values = {};
  }
  setVector3(name, v) {
    this.values[name] = { ...v };
  }
}
export const GameMode = { Survival: "Survival", Creative: "Creative", Adventure: "Adventure", Spectator: "Spectator" };
export const EquipmentSlot = { Mainhand: "Mainhand" };
export const CommandPermissionLevel = { Any: 0, GameDirectors: 1, Admin: 2, Host: 3, Owner: 4 };
export const CustomCommandStatus = { Success: 0, Failure: 1 };
export const CustomCommandParamType = { Boolean: "Boolean", Enum: "Enum", String: "String" };

const maxStack = (typeId) => (typeId.startsWith("bpc:postcard_") || typeId === "bpc:album" ? 1 : 64);

class Props {
  constructor() {
    this.props = new Map();
    this.failWrites = false; // ตั้งเป็น true เพื่อจำลองการเขียน DP ไม่สำเร็จ
  }
  getDynamicProperty(key) {
    return this.props.get(key);
  }
  setDynamicProperty(key, value) {
    if (this.failWrites) throw new Error("write failed");
    if (value === undefined) this.props.delete(key);
    else if (typeof value === "string" && value.length > 32767) throw new Error("ArgumentOutOfBoundsError");
    else this.props.set(key, value);
  }
  getDynamicPropertyIds() {
    return [...this.props.keys()];
  }
}

export class ItemStack extends Props {
  constructor(typeId, amount = 1) {
    super();
    this.typeId = typeId;
    this.amount = amount;
    this.maxAmount = maxStack(typeId);
    this.lore = [];
    this.keepOnDeath = false;
    this.nameTag = undefined;
  }
  setDynamicProperty(key, value) {
    if (this.maxAmount > 1) throw new Error("Cannot set dynamic properties on stackable items.");
    super.setDynamicProperty(key, value);
  }
  setLore(lines) {
    this.lore = lines ?? [];
  }
  getLore() {
    return this.lore;
  }
  clone() {
    const copy = new ItemStack(this.typeId, this.amount);
    copy.lore = this.lore;
    copy.keepOnDeath = this.keepOnDeath;
    copy.nameTag = this.nameTag;
    for (const [k, v] of this.props) copy.props.set(k, v);
    return copy;
  }
}

// getItem คืนสำเนาเหมือนของจริง แก้แล้วต้อง setItem กลับ
class Container {
  constructor(size = 36) {
    this.size = size;
    this.slots = new Array(size).fill(undefined);
  }
  get emptySlotsCount() {
    return this.slots.filter((s) => !s).length;
  }
  getItem(slot) {
    return this.slots[slot] ? this.slots[slot].clone() : undefined;
  }
  setItem(slot, item) {
    this.slots[slot] = item ? item.clone() : undefined;
  }
  addItem(item) {
    let left = item.amount;
    if (item.maxAmount > 1) {
      for (const s of this.slots) {
        if (!s || s.typeId !== item.typeId || s.amount >= s.maxAmount) continue;
        const n = Math.min(left, s.maxAmount - s.amount);
        s.amount += n;
        left -= n;
        if (!left) return undefined;
      }
    }
    for (let i = 0; i < this.size && left > 0; i++) {
      if (this.slots[i]) continue;
      const placed = item.clone();
      placed.amount = Math.min(left, placed.maxAmount);
      this.slots[i] = placed;
      left -= placed.amount;
    }
    if (!left) return undefined;
    const rest = item.clone();
    rest.amount = left;
    return rest;
  }
  items() {
    return this.slots.filter(Boolean);
  }
  fill(typeId = "minecraft:dirt") {
    for (let i = 0; i < this.size; i++) if (!this.slots[i]) this.slots[i] = new ItemStack(typeId, 64);
  }
}

let nextId = 1;
class Player extends Props {
  constructor({ name = "Tester", x = 0, y = 64, z = 0, dimension, mode = GameMode.Survival } = {}) {
    super();
    this.id = String(-nextId++);
    this.typeId = "minecraft:player";
    this.name = name;
    this.location = { x, y, z };
    this.dimension = dimension;
    this.mode = mode;
    this.health = 20;
    this.isValid = true;
    this.container = new Container();
    this.selected = 0;
    this.titles = [];
    this.actionBars = [];
    this.messages = [];
    this.sounds = [];
    this.onScreenDisplay = {
      setTitle: (title, options) => this.titles.push({ title, options }),
      setActionBar: (text) => this.actionBars.push(text),
    };
  }
  getGameMode() {
    return this.mode;
  }
  getComponent(id) {
    if (id === "minecraft:inventory") return { container: this.container };
    if (id === "minecraft:health") return { currentValue: this.health };
    if (id === "minecraft:equippable") {
      return {
        getEquipmentSlot: () => ({
          getItem: () => this.container.getItem(this.selected),
          setItem: (item) => this.container.setItem(this.selected, item),
        }),
      };
    }
    return undefined;
  }
  playSound(id) {
    this.sounds.push(id);
  }
  sendMessage(message) {
    this.messages.push(message);
  }
  /** ย้ายผู้เล่น (ตัวช่วยของเทสต์) */
  moveTo(x, y, z, dimension) {
    this.location = { x, y, z };
    if (dimension) this.dimension = dimension;
  }
}

class Permutation {
  constructor(states) {
    this.states = states;
  }
  getState(name) {
    return this.states[name];
  }
  withState(name, value) {
    return new Permutation({ ...this.states, [name]: value });
  }
}

class Block {
  constructor(dimension, x, y, z, typeId, states) {
    this.dimension = dimension;
    this.location = { x, y, z };
    this.x = x;
    this.y = y;
    this.z = z;
    this.typeId = typeId;
    this.permutation = new Permutation(states);
  }
  setPermutation(perm) {
    this.permutation = perm;
  }
}

class Dimension {
  constructor(id) {
    this.id = id;
    this.biome = () => "minecraft:plains"; // เทสต์ตั้งเองได้ คืน null = chunk ยังไม่โหลด
    this.drops = [];
    this.particles = 0;
    this.blocks = new Map();
  }
  getBiome(location) {
    const id = this.biome(location);
    if (id === null) throw new Error("LocationInUnloadedChunkError");
    return { id };
  }
  spawnItem(item, location) {
    this.drops.push({ item, location });
    return {};
  }
  spawnParticle(id, location, vars) {
    this.particles++;
    this.lastParticle = { id, location, vars };
  }
  getBlock({ x, y, z }) {
    return this.blocks.get(`${x},${y},${z}`);
  }
}

class Signal {
  constructor() {
    this.handlers = [];
  }
  subscribe(fn) {
    this.handlers.push(fn);
    return fn;
  }
  emit(event) {
    for (const h of this.handlers) h(event);
  }
}

export const world = Object.assign(new Props(), {
  players: [],
  dimensions: new Map(),
  day: 0,
  timeOfDay: 6000,
  moonPhase: 4,
  getAllPlayers() {
    return this.players.filter((p) => p.isValid);
  },
  getEntity(id) {
    return this.players.find((p) => p.id === id && p.isValid);
  },
  getDay() {
    return this.day;
  },
  getTimeOfDay() {
    return this.timeOfDay;
  },
  getMoonPhase() {
    return this.moonPhase;
  },
  getDimension(id) {
    if (!this.dimensions.has(id)) this.dimensions.set(id, new Dimension(id));
    return this.dimensions.get(id);
  },
  afterEvents: { worldLoad: new Signal(), playerSpawn: new Signal(), playerLeave: new Signal(), weatherChange: new Signal(), itemUse: new Signal() },
  beforeEvents: { playerBreakBlock: new Signal() },
});

export const system = {
  intervals: [],
  timeouts: [],
  currentTick: 0,
  /** รันเมื่อเทสต์เดินเวลาด้วย mock.advance() */
  runTimeout(fn, ticks = 1) {
    this.timeouts.push({ fn, at: this.currentTick + Math.max(1, ticks) });
    return this.timeouts.length;
  },
  run(fn) {
    fn();
    return 0;
  },
  runInterval(fn, ticks) {
    this.intervals.push({ fn, ticks });
    return this.intervals.length;
  },
  waitTicks() {
    return Promise.resolve();
  },
  beforeEvents: { startup: new Signal() },
  afterEvents: { scriptEventReceive: new Signal() },
};

export const BiomeTypes = {
  ids: [],
  getAll() {
    return this.ids.map((id) => ({ id }));
  },
  get(id) {
    return this.ids.includes(id) ? { id } : undefined;
  },
};

/** ตัวช่วยของเทสต์ ไม่มีใน API จริง */
export const mock = {
  reset() {
    world.props.clear();
    world.failWrites = false;
    world.players.length = 0;
    world.dimensions.clear();
    world.day = 0;
    world.timeOfDay = 6000;
    world.moonPhase = 4;
    system.intervals.length = 0;
    system.timeouts.length = 0;
    system.currentTick = 0;
    nextId = 1;
  },
  /** เดินเวลาไป n tick และรัน runTimeout ที่ถึงกำหนด (รวมตัวที่ถูกตั้งเพิ่มระหว่างทาง) */
  advance(ticks = 1) {
    for (let i = 0; i < ticks; i++) {
      system.currentTick++;
      const due = system.timeouts.filter((t) => t.at <= system.currentTick);
      system.timeouts = system.timeouts.filter((t) => t.at > system.currentTick);
      for (const t of due) t.fn();
    }
  },
  player(options = {}) {
    const dimension = world.getDimension(options.dim ?? "minecraft:overworld");
    const player = new Player({ ...options, dimension });
    world.players.push(player);
    return player;
  },
  block(dimId, x, y, z, typeId, states = {}) {
    const dimension = world.getDimension(dimId);
    const block = new Block(dimension, x, y, z, typeId, states);
    dimension.blocks.set(`${x},${y},${z}`, block);
    return block;
  },
  /** ตัวรับการลงทะเบียน custom component / คำสั่ง ตอน startup */
  registry() {
    const components = new Map();
    const commands = new Map();
    const enums = new Map();
    return {
      components,
      commands,
      enums,
      registerEnum: (name, values) => enums.set(name, values),
      registerCustomComponent: (id, def) => components.set(id, def),
      registerCommand: (def, callback) => commands.set(def.name, { def, callback }),
    };
  },
};
