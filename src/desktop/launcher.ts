/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { ExtensionContext, Uri } from 'vscode';

import { MessageChannel, Worker } from 'worker_threads';

import { BaseLauncher } from '../common/launcher';

import { ServiceConnection, MessageConnection } from '@vscode/sync-api-common/node';

import { Requests } from '@vscode/sync-api-service';
import { MessageRequests } from '../common/messages';

export class DesktopLauncher extends BaseLauncher {

	private worker: Worker | undefined;

	public constructor() {
		super();
	}

	protected async createMessageConnection(context: ExtensionContext): Promise<MessageConnection<MessageRequests, undefined>> {
		const filename = Uri.joinPath(context.extensionUri, './out/desktop/pythonWasmWorker.js').fsPath;
		this.worker = new Worker(filename);
		const channel = new MessageChannel();
		const ready = new Promise<void>((resolve, reject) => {
			if (this.worker === undefined) {
				reject(new Error(`Worker died unexpectedly.`));
				return;
			}
			this.worker.once('message', (value: string) => {
				if (value === 'ready') {
					resolve();
				} else {
					reject(new Error(`Missing ready event from worker`));
				}
			});
		});
		this.worker.postMessage(channel.port2, [channel.port2]);
		await ready;
		return new MessageConnection<MessageRequests, undefined>(channel.port1);
	}

	protected async createSyncConnection(messageConnection: MessageConnection<MessageRequests, undefined>): Promise<[ServiceConnection<Requests>, any]> {
		const channel = new MessageChannel();
		const result = new ServiceConnection<Requests>(channel.port1);
		return [result, channel.port2];
	}

	protected async terminateConnection(): Promise<void> {
		await this.worker?.terminate();
	}
}