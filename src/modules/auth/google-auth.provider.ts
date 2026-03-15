import { FactoryProvider } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

export const GoogleOAuthProvider: FactoryProvider = {
    provide: 'GOOGLE_OAUTH',
    useFactory: () => {
        return new OAuth2Client();
    },
    inject: [],
};
