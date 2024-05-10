import { IAuthOptions } from "./AuthOptions.js";
import { StringUtil } from "../Utility/StringUtil.js";
import { throwError } from "../Exceptions/index.js";
import { ClientOptions } from "ws";
import { Agent } from "undici-types";
import { ConnectionOptions } from "node:tls";

export type CertificateType = "pem" | "pfx";

export interface ICertificate {
    toAgentOptions(): Agent.Options;
    toSocketOptions(): ConnectionOptions;
    toWebSocketOptions(): ClientOptions;
}

export abstract class Certificate implements ICertificate {
    public static readonly PEM: CertificateType = "pem";
    public static readonly PFX: CertificateType = "pfx";

    protected _certificate: string | Buffer;
    protected _ca: string | Buffer;
    protected _passphrase?: string;

    public static createFromOptions(options: IAuthOptions): ICertificate {
        if (!options) {
            return null;
        }

        let certificate: ICertificate = null;

        if (!options.certificate) {
            throwError("InvalidArgumentException", "Certificate cannot be null");
        }

        switch (options.type) {
            case Certificate.PEM: {
                certificate = this.createPem(options.certificate, options.password, options.ca);
                break;
            }
            case Certificate.PFX: {
                certificate = this.createPfx(options.certificate, options.password, options.ca);
                break;
            }
            default: {
                throwError("InvalidArgumentException", "Unsupported authOptions type: " + options.type);
            }
        }

        return certificate;
    }

    public static createPem(certificate: string | Buffer, passphrase?: string, ca?: string | Buffer) {
        return new PemCertificate(certificate, passphrase, ca);
    }

    public static createPfx(certificate: string | Buffer, passphrase?: string, ca?: string | Buffer) {
        return new PfxCertificate(certificate, passphrase, ca);
    }

    protected constructor(certificate: string | Buffer, passphrase?: string, ca?: string | Buffer) {
        this._certificate = certificate;
        this._passphrase = passphrase;
        this._ca = ca;
    }

    public toAgentOptions(): Agent.Options {
        if (this._passphrase) {
            return {
                connect: {
                    passphrase: this._passphrase
                }
            }
        }

        return {};
    }

    toSocketOptions(): ConnectionOptions {
        if (this._passphrase) {
            return {
                passphrase: this._passphrase
            }
        }
        return {};
    }

    public toWebSocketOptions(): ClientOptions {
        if (this._passphrase) {
            return { passphrase: this._passphrase };
        }

        return {};
    }
}

export class PemCertificate extends Certificate {
    private readonly _certToken: string = "CERTIFICATE";
    private readonly _keyToken: string = "RSA PRIVATE KEY";
    protected _key: string;

    constructor(certificate: string | Buffer, passphrase?: string, ca?: string | Buffer) {
        super(certificate, passphrase, ca);

        if (certificate instanceof Buffer) {
            this._certificate = certificate.toString();
        }

        this._key = this._fetchPart(this._keyToken);
        this._certificate = this._fetchPart(this._certToken);

        if (!this._key && !this._certificate) {
            throwError("InvalidArgumentException", "Invalid .pem certificate provided");
        }
    }

    public toAgentOptions(): Agent.Options {
        const { connect, ...rest } = super.toAgentOptions();
        return {
            ...rest,
            connect: {
                ...connect,
                cert: this._certificate,
                key: this._key,
                ca: this._ca
            }
        }
    }

    public toSocketOptions(): ConnectionOptions {
        const options = super.toSocketOptions();
        return {
            ...options,
            cert: this._certificate,
            key: this._key,
            ca: this._ca
        }
    }

    public toWebSocketOptions(): ClientOptions {
        const result = super.toWebSocketOptions();
        return Object.assign(result, {
            cert: this._certificate,
            key: this._key,
            ca: this._ca
        });
    }

    protected _fetchPart(token: string): string {
        const cert: string = this._certificate as string;
        const prefixSuffix: string = "-----";
        const beginMarker: string = `${prefixSuffix}BEGIN ${token}${prefixSuffix}`;
        const endMarker: string = `${prefixSuffix}END ${token}${prefixSuffix}`;

        if (cert.includes(beginMarker) && cert.includes(endMarker)) {
            const part: string = cert.substring(
                cert.indexOf(beginMarker),
                cert.indexOf(endMarker) + endMarker.length
            );

            if (!StringUtil.isNullOrWhitespace(part)) {
                return part;
            }
        }

        return null;
    }
}

export class PfxCertificate extends Certificate {
    constructor(certificate: string | Buffer, passphrase?: string, ca?: string | Buffer) {
        if (!(certificate instanceof Buffer)) {
            throwError("InvalidArgumentException", "Pfx certificate should be a Buffer");
        }

        super(certificate, passphrase, ca);
    }

    public toAgentOptions(): Agent.Options {
        const { connect, ...rest } = super.toAgentOptions();
        return {
            ...rest,
            connect: {
                ...connect,
                pfx: this._certificate,
                ca: this._ca ?? undefined
            }
        }
    }

    toSocketOptions(): ConnectionOptions {
        const options = super.toSocketOptions();
        return {
            ...options,
            pfx: this._certificate,
            ca: this._ca
        }
    }

    public toWebSocketOptions(): ClientOptions {
        const result = super.toWebSocketOptions();
        return Object.assign(result, {
            pfx: this._certificate as Buffer,
            ca: this._ca
        });
    }
}
