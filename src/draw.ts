import * as fs from "fs";
import * as path from "path";
import * as promptly from "promptly";
import { Slip10RawIndex } from '@cosmjs/crypto';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { SigningStargateClient } from "@cosmjs/stargate";
import { getSigningOsmosisClient } from 'osmojs';
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";

import * as keystore from "./keystore";

type ArtData = {
  viewport: {
    x: number;
    y: number;
  };
  pixels: number[][];
};

const { viewport, pixels }: ArtData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/larry.json"), "utf8")
);

const ORIGIN = [45, 65];
const START = [0, 0];

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

(async function () {
  const password = await promptly.password("Enter a password to encrypt the key:");
  const mnemonic = keystore.load(
    "validator",
    path.join(__dirname, "../keys"),
    password,
  );

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

  for (let i = START[0]; i < viewport.x; i++) {
    for (let j = START[1]; j < viewport.y; j++) {
      const x = ORIGIN[0] + i;
      const y = ORIGIN[1] + j;
      const color = pixels[i][j];
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
})();
