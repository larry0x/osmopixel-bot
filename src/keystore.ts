import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as promptly from "promptly";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

export const DEFAULT_KEY_DIR = path.join(__dirname, "../keys");

const KEY_SIZE = 256;
const ITERATIONS = 100;

function encrypt(plainText: string, password: string): string {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_SIZE / 8, "sha1");

  const cipher = crypto.createCipheriv("AES-256-CBC", key, iv);
  const encryptedText = Buffer.concat([cipher.update(plainText), cipher.final()]);

  return salt.toString("hex") + iv.toString("hex") + encryptedText.toString("hex");
}

function decrypt(cipherText: string, password: string): string {
  const salt = Buffer.from(cipherText.slice(0, 32), "hex");
  const iv = Buffer.from(cipherText.slice(32, 64), "hex");
  const key = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_SIZE / 8, "sha1");

  const encrypedText = cipherText.slice(64);
  const cipher = crypto.createDecipheriv("AES-256-CBC", key, iv);
  const decryptedText = Buffer.concat([cipher.update(encrypedText, "hex"), cipher.final()]);

  return decryptedText.toString();
}

function save(keyName: string, keyDir: string,mnemonic: string, password: string) {
  const filePath = path.join(keyDir, `${keyName}.key`);
  if (fs.existsSync(filePath)) {
    throw new Error(`file ${filePath} already exists!`);
  }

  const cipherText = encrypt(mnemonic, password);
  fs.writeFileSync(filePath, cipherText);

  return filePath;
}

export function load(keyName: string, keyDir: string, password: string): string {
  const filePath = path.join(keyDir, `${keyName}.key`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`file ${filePath} does not exist!`);
  }

  const cipherText = fs.readFileSync(filePath, "utf8");

  return decrypt(cipherText, password);
}

function remove(keyName: string, keyDir: string) {
  const filePath = path.join(keyDir, `${keyName}.key`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`file ${filePath} does not exist!`);
  }

  fs.unlinkSync(filePath);
}

yargs(hideBin(process.argv))
  .command(
    "add <key>",
    "Add a key with the given name",
    (yargs) => {
      return yargs
        .positional("key", {
          type: "string",
          describe: "name of the key",
          demandOption: true,
        })
        .option("key-dir", {
          type: "string",
          describe: "path to the directory where encrypted key files are stored",
          demandOption: false,
          default: DEFAULT_KEY_DIR,
        })
    },
    async (argv) => {
      if (!fs.existsSync(argv["key-dir"])) {
        fs.mkdirSync(argv["key-dir"], { recursive: true });
      }

      const mnemonic = await promptly.prompt("Enter BIP-39 seed phrase:");

      const password = await promptly.password("Enter a password to encrypt the key:");
      const repeat = await promptly.password("Repeat the password:");
      if (password != repeat) {
        throw new Error("Passwords don't match!");
      }

      const accAddress = save(argv["key"], argv["key-dir"], mnemonic, password);
      console.log("Success! Address:", accAddress);
    },
  )
  .command(
    "remove <key>",
    "Remove a key of the given name",
    (yargs) => {
      return yargs
        .positional("key", {
          type: "string",
          describe: "name of the key",
          demandOption: true,
        })
        .option("key-dir", {
          type: "string",
          describe: "path to the directory where encrypted key files are stored",
          demandOption: false,
          default: DEFAULT_KEY_DIR,
        });
    },
    (argv) => {
      remove(argv["key"], argv["key-dir"]);
      console.log("Success!");
    },
  )
  .command(
    "show <key>",
    "Show a single key",
    (yargs) => {
      return yargs
        .positional("key", {
          type: "string",
          describe: "name of the key",
          demandOption: true,
        })
        .option("key-dir", {
          type: "string",
          describe: "path to the directory where encrypted key files are stored",
          demandOption: false,
          default: DEFAULT_KEY_DIR,
        });
    },
    async (argv) => {
      const password = await promptly.password("Enter the password used to encrypt the key:");
      const mnemonic = load(argv["key"], argv["key-dir"], password);
      console.log(mnemonic);
    },
  )
  .wrap(100)
  .parse();
