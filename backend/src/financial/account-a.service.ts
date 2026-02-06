import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class AccountAService {
    private readonly logger = new Logger(AccountAService.name);

    // Konfigurasi endpoint (disarankan menggunakan ConfigService di produksi)
    private readonly EXCHANGE_API_URL = process.env.EXCHANGE_A_API_URL || 'https://api.opticodds.com/v1/user/balance';
    private readonly API_KEY = process.env.EXCHANGE_A_API_KEY || 'YOUR_SECRET_KEY';

    /**
     * Mengambil saldo dari Exchange Account A secara asinkron.
     * Memenuhi kriteria: async/await, parsing number, null on error, clear logging.
     * @returns Saldo (number) atau null jika terjadi kesalahan.
     */
    async fetchBalance(): Promise<number | null> {
        try {
            this.logger.log(`[EXCHANGE-A] Initiating balance fetch for Account A...`);

            const response = await axios.get(this.EXCHANGE_API_URL, {
                headers: {
                    'Authorization': `Bearer ${this.API_KEY}`,
                    'X-Api-Key': this.API_KEY, // Beberapa exchange menggunakan header berbeda
                    'Accept': 'application/json'
                },
                timeout: 7000 // Timeout 7 detik untuk load tinggi
            });

            // Mendapatkan nilai saldo dari response body
            // Mendukung berbagai struktur response (balance atau data.balance)
            const rawBalance = response.data?.balance ?? response.data?.data?.balance;

            if (rawBalance === undefined || rawBalance === null) {
                this.logger.warn(`[EXCHANGE-A] Balance field missing in response body: ${JSON.stringify(response.data)}`);
                return null;
            }

            // Memastikan hasil adalah angka (float/int)
            const parsedBalance = Number(rawBalance);

            if (isNaN(parsedBalance)) {
                this.logger.error(`[EXCHANGE-A] Invalid numeric format. Raw value: "${rawBalance}"`);
                return null;
            }

            this.logger.log(`[EXCHANGE-A] Balance successfully retrieved: ${parsedBalance}`);
            return parsedBalance;

        } catch (error) {
            // Logging error secara mendetail untuk mempermudah debugging
            const status = error.response?.status;
            const message = error.response?.data?.message || error.message;

            this.logger.error(
                `[EXCHANGE-A] Failed to fetch balance! ` +
                `Reason: ${message} ` +
                `(HTTP Status: ${status || 'NETWORK_ERROR'})`
            );

            return null;
        }
    }
}
