
import { DashboardLayout } from "@/components/DashboardLayout";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, BookOpen } from "lucide-react";
import { libraryApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface Book {
  id: string;
  title: string;
  author: string;
  subject: string;
  available: boolean;
  coverImage: string;
  description: string;
}

const Library = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [books, setBooks] = useState<Book[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([]);

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const response = await libraryApi.getAllBooks();
        
        if (response.error) {
          toast({
            title: "Error",
            description: response.error,
            variant: "destructive",
          });
          return;
        }
        
        if (response.data) {
          setBooks(response.data);
          setFilteredBooks(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch books:", error);
        toast({
          title: "Error",
          description: "Failed to fetch books. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    // Mock data for demonstration
    setTimeout(() => {
      const mockBooks: Book[] = [
        {
          id: "1",
          title: "Introduction to Computer Science",
          author: "John Smith",
          subject: "Computer Science",
          available: true,
          coverImage: "/placeholder.svg",
          description: "A comprehensive introduction to computer science principles."
        },
        {
          id: "2",
          title: "Advanced Mathematics",
          author: "Sarah Johnson",
          subject: "Mathematics",
          available: true,
          coverImage: "/placeholder.svg",
          description: "Advanced topics in mathematics for university students."
        },
        {
          id: "3",
          title: "Modern Physics",
          author: "Robert Brown",
          subject: "Physics",
          available: false,
          coverImage: "/placeholder.svg",
          description: "An exploration of modern physics theories and applications."
        },
        {
          id: "4",
          title: "World History: A Comprehensive Guide",
          author: "Emma Wilson",
          subject: "History",
          available: true,
          coverImage: "/placeholder.svg",
          description: "A detailed analysis of world history from ancient to modern times."
        },
        {
          id: "5",
          title: "Organic Chemistry Fundamentals",
          author: "David Clark",
          subject: "Chemistry",
          available: true,
          coverImage: "/placeholder.svg",
          description: "Essential principles and practices in organic chemistry."
        },
        {
          id: "6",
          title: "Introduction to Psychology",
          author: "Michelle Lee",
          subject: "Psychology",
          available: false,
          coverImage: "/placeholder.svg",
          description: "A foundational text covering the major theories in psychology."
        },
      ];
      
      setBooks(mockBooks);
      setFilteredBooks(mockBooks);
      setIsLoading(false);
    }, 1000);
    
    // Uncomment to use real API
    // fetchBooks();
  }, []);

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setFilteredBooks(books);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const results = books.filter(
      book => 
        book.title.toLowerCase().includes(query) || 
        book.author.toLowerCase().includes(query) || 
        book.subject.toLowerCase().includes(query)
    );
    
    setFilteredBooks(results);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };
  
  const handleBorrowBook = async (bookId: string) => {
    try {
      const response = await libraryApi.borrowBook(bookId);
      
      if (response.error) {
        toast({
          title: "Borrow Failed",
          description: response.error,
          variant: "destructive",
        });
        return;
      }
      
      // Update the book's availability in the UI
      const updatedBooks = books.map(book => 
        book.id === bookId ? { ...book, available: false } : book
      );
      
      setBooks(updatedBooks);
      setFilteredBooks(
        filteredBooks.map(book => 
          book.id === bookId ? { ...book, available: false } : book
        )
      );
      
      toast({
        title: "Success",
        description: "Book borrowed successfully!",
      });
    } catch (error) {
      console.error("Failed to borrow book:", error);
      toast({
        title: "Error",
        description: "Failed to borrow book. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout userType="student">
      <h1 className="page-title">Digital Library</h1>
      
      <div className="mb-6 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, author, or subject..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <Button onClick={handleSearch}>Search</Button>
      </div>
      
      {isLoading ? (
        <div className="text-center py-12">Loading books...</div>
      ) : filteredBooks.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
          <p>No books found. Try a different search term.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBooks.map((book) => (
            <Card key={book.id} className="overflow-hidden">
              <div className="aspect-[3/2] relative bg-muted">
                <img 
                  src={book.coverImage} 
                  alt={book.title}
                  className="object-cover w-full h-full"
                />
                <div className="absolute top-2 right-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    book.available 
                      ? "bg-green-100 text-green-700" 
                      : "bg-red-100 text-red-700"
                  }`}>
                    {book.available ? "Available" : "Borrowed"}
                  </span>
                </div>
              </div>
              <CardHeader>
                <CardTitle className="line-clamp-1">{book.title}</CardTitle>
                <p className="text-sm text-muted-foreground">By {book.author}</p>
                <p className="text-xs bg-secondary inline-block px-2 py-1 rounded-full">
                  {book.subject}
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-sm line-clamp-3">{book.description}</p>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  disabled={!book.available}
                  onClick={() => book.available && handleBorrowBook(book.id)}
                >
                  {book.available ? "Borrow Now" : "Currently Unavailable"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
};

export default Library;
