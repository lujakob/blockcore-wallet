import { BlockcoreIdentity } from './identity';
import { KeyPair } from './interfaces';
import { JsonWebKey, VerificationMethod } from 'did-resolver';
import * as secp from '@noble/secp256k1';
import { HDKey } from '@scure/bip32';
import { base64url } from '@scure/base';
import { ES256KSigner } from 'did-jwt';

export class BlockcoreIdentityTools {
  /** Get the address (identity) of this DID. Returned format is "did:is:[publicKey]". Supports using publicKeyMultibase or publicKey, which can be in format of schnorr string, or array of both Schnorr and ECDSA type. */
  getIdentifier(options: { publicKey?: string | Uint8Array; publicKeyMultibase?: string }) {
    let pubkey = '';

    // If the buffer is not supplied, then we'll convert base58 to buffer.
    if (options.publicKeyMultibase) {
      pubkey = options.publicKeyMultibase.slice(1); // Slice off the multibase prefix, 'f'.
    }

    if (options.publicKey instanceof Uint8Array) {
      let buffer = null;

      if (options.publicKey.length == 33) {
        buffer = this.convertEdcsaPublicKeyToSchnorr(options.publicKey);
      } else {
        buffer = options.publicKey;
      }

      pubkey = this.schnorrPublicKeyToHex(buffer);
    } else {
      pubkey = options.publicKey;
    }

    return `${BlockcoreIdentity.PREFIX}${pubkey}`;
  }

  private numTo32String(num: number | bigint): string {
    return num.toString(16).padStart(64, '0');
  }

  /** The  */
  getJsonWebKey(publicKeyHex: string): JsonWebKey {
    const pub = secp.Point.fromHex(publicKeyHex);
    const x = secp.utils.hexToBytes(this.numTo32String(pub.x));
    const y = secp.utils.hexToBytes(this.numTo32String(pub.y));

    return {
      kty: 'EC',
      crv: 'secp256k1',
      x: base64url.encode(x), // This version of base64url uses padding.
      y: base64url.encode(y), // Without padding: Buffer.from(bytesOfX).toString('base64url')
    };
  }

  getPublicKey(publicKey: Uint8Array) {
    return this.schnorrPublicKeyToHex(publicKey);
  }

  getPublicKeyFromPrivateKey(privateKey: Uint8Array) {
    return secp.schnorr.getPublicKey(privateKey);
  }

  convertEdcsaPublicKeyToSchnorr(publicKey: Uint8Array) {
    if (publicKey.length != 33) {
      throw Error('The public key must be compressed EDCSA public key of length 33.');
    }

    const schnorrPublicKey = publicKey.slice(1);
    return schnorrPublicKey;
  }

  //   getIdentifiers(identity: string | any): { id: string; controller: string } {
  //     return {
  //       id: `${identity}#key-1`,
  //       controller: `${identity}`,
  //     };
  //   }

  //   getProfileNetwork() {
  //     return {
  //       messagePrefix: '\x18Identity Signed Message:\n',
  //       bech32: 'id',
  //       bip32: {
  //         public: 0x0488b21e,
  //         private: 0x0488ade4,
  //       },
  //       pubKeyHash: 55,
  //       scriptHash: 117,
  //       wif: 0x08,
  //     };
  //   }

  //   getIdentifier(publicKey: Uint8Array) {
  //     return this.schnorrPublicKeyToHex(
  //       this.convertEdcsaPublicKeyToSchnorr(publicKey)
  //     );
  //   }

  //   convertEdcsaPublicKeyToSchnorr(publicKey: Uint8Array) {
  //     if (publicKey.length != 33) {
  //       throw Error(
  //         'The public key must be compressed EDCSA public key of length 33.'
  //       );
  //     }

  //     const schnorrPublicKey = publicKey.slice(1);
  //     return schnorrPublicKey;
  //   }

  async getSigner(node: HDKey) {
    const signer = ES256KSigner(node.privateKey);
    return signer;
  }

  schnorrPublicKeyToHex(publicKey: Uint8Array) {
    return secp.utils.bytesToHex(publicKey);
  }

  generateKey(): Uint8Array {
    return secp.utils.randomPrivateKey();
  }

  /** Generates a random private key and includes the public key and the full identifier (with did:is prefix). */
  generateKeyPair(): KeyPair {
    const key = this.generateKey();
    const pubkey = this.getPublicKeyFromPrivateKey(key);
    const identifier = this.getIdentifier({ publicKey: pubkey });

    return {
      privateKey: key,
      publicKey: pubkey,
      identifier: identifier,
    };
  }

  /** Used to create an instance of the key pair from base58/hex formats. The public key must be in base58 encoding. */
  //   async keyPairFrom(options: {
  //     publicKeyBase58: string | any;
  //     privateKeyBase58?: string;
  //     privateKeyHex?: string;
  //     privateKeyJwk?: string | any | ISecp256k1PrivateKeyJwk;
  //   }): Promise<Secp256k1KeyPair> {
  //     if (options.privateKeyHex && options.privateKeyHex.startsWith('0x')) {
  //       options.privateKeyHex = options.privateKeyHex.substring(2);
  //     }

  //     const identity = this.getIdentity(options);
  //     const identifiers = this.getIdentifiers(identity);

  //     options = Object.assign(options, identifiers);

  //     // Get a new key instance parsed from either base58, hex or jwk.
  //     // The public key we require to base58, because we must include it in the options to override defaults.
  //     const key = await Secp256k1KeyPair.from(options);

  //     return key;
  //   }

  /** Converts the KeyPair and returns an verificationMethod structure with multibase public key. */

  /** Get a VerificationMethod structure from a keypair instance. */
  getVerificationMethod(privateKey: Uint8Array, keyIndex: number = 1): VerificationMethod {
    const publicKey = secp.schnorr.getPublicKey(privateKey);
    const publicKeyHex = secp.utils.bytesToHex(publicKey);
    const did = `${BlockcoreIdentity.PREFIX}${publicKeyHex}`;

    return {
      id: `${did}#keys-${keyIndex}`,
      // We must use this type while we wait for "did-jwt" support Schnorr:
      type: 'EcdsaSecp256k1VerificationKey2019', // Reference: 'SchnorrSecp256k1Signature2019' / 'JsonWebKey2020'
      controller: did,
      publicKeyJwk: this.getJsonWebKey(publicKeyHex),
      // publicKeyMultibase: 'f' + pubKeyHex,
    };
  }
}