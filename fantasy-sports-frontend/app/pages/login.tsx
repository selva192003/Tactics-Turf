"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { auth, googleProvider, signInWithPopup } from '../utils/firebase';

const Login = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      await authenticateWithBackend(idToken);
    } catch (err) {
      console.error(err);
      setError('Failed to sign in with Google.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      // NOTE: For this simple example, we're not using email/password on the backend
      // But you would get an idToken here as well
      const result = await auth.signInWithEmailAndPassword(email, password);
      const idToken = await result.user.getIdToken();
      await authenticateWithBackend(idToken);
    } catch (err) {
      console.error(err);
      setError('Failed to sign in with email. Check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const authenticateWithBackend = async (idToken: string) => {
    try {
      // Make sure your backend server is running on port 5000
      const res = await axios.post('http://localhost:5000/api/auth/login', { token: idToken });
      
      // Store the JWT from our backend securely
      localStorage.setItem('token', res.data.token);
      console.log('Authentication successful:', res.data.user);
      
      // Redirect to the homepage or dashboard
      router.push('/');
    } catch (error) {
      console.error('Backend authentication failed:', error);
      setError('Failed to authenticate with our service. Please try again.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-text">
      <div className="p-8 rounded-lg shadow-xl w-full max-w-md bg-white/5 backdrop-blur-lg">
        <h1 className="text-3xl font-bold text-center text-white mb-6">Login</h1>
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <img src="/google.svg" alt="Google logo" className="h-5 w-5 mr-2" />
          <span>Sign in with Google</span>
        </button>
        <p className="text-center text-gray-400 my-4">OR</p>
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary text-white font-bold py-2 rounded-lg hover:bg-primary-dark transition duration-300 ease-in-out"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;