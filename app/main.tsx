import {createRoot} from 'react-dom/client';
import TripApp from './trip-app';
import InstallPrompt from './install-prompt';
import './globals.css';
createRoot(document.getElementById('root')!).render(<><TripApp/><InstallPrompt/><footer className="site-credit">made by 전상현쌤</footer></>);
