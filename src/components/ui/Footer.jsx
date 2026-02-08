import { Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 py-4">
      <div className="container mx-auto flex justify-center items-center text-sm text-gray-600">
        <span>Made with </span>
        <Heart className="h-4 w-4 mx-1 text-red-500 fill-current" />
        <span> by </span>
        <a 
          href="https://www.linkedin.com/in/aadisheshu-konga" 
          target="_blank" 
          rel="noopener noreferrer"
          className="ml-1 font-medium text-indigo-600 hover:text-indigo-500 transition underline-offset-2 hover:underline"
        >
          aadi
        </a>
      </div>
    </footer>
  );
}