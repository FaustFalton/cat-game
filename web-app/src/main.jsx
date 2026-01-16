import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui.js/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@mysten/dapp-kit/dist/index.css'; // Style mặc định cho nút ví

const queryClient = new QueryClient();
const networks = {
	testnet: { url: getFullnodeUrl('testnet') },
};

ReactDOM.createRoot(document.getElementById('root')).render(
	<React.StrictMode>
		<QueryClientProvider client={queryClient}>
			<SuiClientProvider networks={networks} defaultNetwork="testnet">
				<WalletProvider>
					<App />
				</WalletProvider>
			</SuiClientProvider>
		</QueryClientProvider>
	</React.StrictMode>,
);