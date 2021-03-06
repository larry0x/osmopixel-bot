import * as fs from "fs";
import * as path from "path";
import * as promptly from "promptly";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { Slip10RawIndex } from '@cosmjs/crypto';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { SigningStargateClient } from "@cosmjs/stargate";
import { getSigningOsmosisClient } from 'osmojs';
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";

import * as keystore from "./keystore";

async function sleep(ms: number) {
  console.log(`Sleeping for ${ms} ms...`);
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForBlocks(client: SigningStargateClient, startFrom: number, waitFor = 30) {
  console.log(`Starting from ${startFrom}, waiting for ${waitFor} blocks`)
  while (true) {
    const height = await client.getHeight();
    console.log("Current height:", height);

    if (height > startFrom + waitFor) {
      return;
    }

    await sleep(10000);
  }
}

async function draw(mnemonic: string, pixels: number[][]) {
  const signer = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: "osmo",
    hdPaths: [
      [
        Slip10RawIndex.hardened(44),
        Slip10RawIndex.hardened(118),
        Slip10RawIndex.hardened(0),
        Slip10RawIndex.normal(0),
        Slip10RawIndex.normal(0),
      ]
    ],
  });
  const signerAddress = (await signer.getAccounts())[0].address;

  const client = await getSigningOsmosisClient({
    rpcEndpoint: "https://rpc.osmosis.zone/",
    signer,
  });

  for (const pixel of pixels) {
    let [x, y, color] = pixel;
    x -= 1;
    y -= 1;
    console.log(`x = ${x}, y = ${y}, color = ${color}`)

    const msg = {
      typeUrl: "/cosmos.bank.v1beta1.MsgSend",
      value: MsgSend.fromPartial({
        fromAddress: signerAddress,
        toAddress: signerAddress,
        amount: [{ denom: "uosmo", amount: "1" }],
      }),
    };

    const memo = `osmopixel (${x},${y},${color})`;

    const { height, transactionHash } = await client.signAndBroadcast(
      signerAddress,
      [msg],
      {
        gas: "200000",
        amount: [],
      },
      memo
    );
    console.log(`Broadcasted! height = ${height}, txhash = ${transactionHash}`);

    await waitForBlocks(client, height, 30);
  }
}

const argv = yargs(hideBin(process.argv))
  .option("key", {
    alias: "k",
    type: "string",
    description: "name of the key to use",
    demandOption: true,
  })
  .option("pixels", {
    alias: "p",
    type: "string",
    description: "path to a JSON file containing the pixels to draw",
    demandOption: true,
  })
  .wrap(100)
  .parseSync();

(async function () {
  const password = await promptly.password("Enter the password used to encrypt the key:");
  const mnemonic = keystore.load(argv["key"], keystore.DEFAULT_KEY_DIR, password);

  const pixels: number[][] = JSON.parse(fs.readFileSync(path.resolve(argv["pixels"]), "utf8"));

  await draw(mnemonic, pixels);
})();
