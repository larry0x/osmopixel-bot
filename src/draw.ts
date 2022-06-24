import * as fs from "fs";
import * as path from "path";
import * as promptly from "promptly";
import { Slip10RawIndex } from '@cosmjs/crypto';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { SigningStargateClient } from "@cosmjs/stargate";
import { getSigningOsmosisClient } from 'osmojs';
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";

import * as keystore from "./keystore";
import * as osmosisPixel from "./osmosis_pixel";

type ArtData = {
  viewport: {
    x: number;
    y: number;
  };
  pixels: number[][];
};

const { viewport, pixels }: ArtData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/tedcrypto.json"), "utf8")
);

const ORIGIN = [70, 70];
const START = [0, 0];

async function sleep(ms: number) {
  console.log(`Sleeping for ${ms} ms...`);
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForBlocks(client: SigningStargateClient, startFrom: number, waitFor = 30) {
  console.log(`Starting from ${startFrom}, waiting for ${waitFor} blocks`)
  while (true) {
    let height = null;
    while (!height) {
      try {
        height = await client.getHeight();
      } catch (exception) {
        console.log('Problem fetching the height... Trying again in few seconds')
        await sleep(10000)
      }
    }

    const heightWanted = startFrom + waitFor;
    console.log("Current height:", height, " Height wanted:", heightWanted, " Difference:", heightWanted - height);

    if (height > heightWanted) {
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
  console.log('Wallet address:', signerAddress);

  const client = await getSigningOsmosisClient({
    rpcEndpoint: "https://rpc-osmosis.blockapsis.com/",
    signer,
  });

  for (let i = START[0]; i < viewport.x; i++) {
    for (let j = START[1]; j < viewport.y; j++) {
      const x = ORIGIN[0] + i;
      const y = ORIGIN[1] + j;
      const color = pixels[i][j];
      console.log(`x = ${x}, y = ${y}, color = ${color}`)

      if (await osmosisPixel.isColor({'x': x.toString(), 'y': y.toString()}, color)) {
        console.log(`Pixel ${x},${y} is already ${color}`);
        continue;
      }

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
