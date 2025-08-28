import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Menu,
  X,
  BookOpen,
  Users,
  Home,
  Mail,
  LogIn,
  UserPlus,
  GraduationCap,
  Building2,
  Briefcase,
  Handshake,
  HelpCircle,
} from "lucide-react";
import Logo from "@/assets/yagnatech.png"; // Adjust the path as necessary

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => location.pathname === path;

  // Scroll helper
  const scrollToTopWithOffset = (e, path) => {
    e.preventDefault();
    navigate(path);
    setTimeout(() => {
      const navbarHeight = 80; // Adjust to match lg:h-20 height
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
      // if you had anchor targets, you could use:
      // const element = document.querySelector(path);
      // if (element) {
      //   const y = element.getBoundingClientRect().top + window.pageYOffset - navbarHeight;
      //   window.scrollTo({ top: y, behavior: "smooth" });
      // }
    }, 50);
    setIsMenuOpen(false);
  };

  const navigation = [
    { name: "Home", href: "/", icon: Home },
    { name: "About Us", href: "/about", icon: Users },
    { name: "Opportunities", href: "/students", icon: BookOpen },
    { name: "Contact", href: "/contact", icon: Mail },
    { name: "Partners", href: "/partners", icon: Handshake, dropdown: true  },
    // { name: "FAQ's", href: "/faqs", icon: HelpCircle },
  ];

  const partnerItems = [
    { name: "Colleges", href: "/colleges", icon: Building2 },
    { name: "Companies", href: "/companies", icon: Briefcase },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border/50">
      <div className="container-ngo">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link
            to="/"
            onClick={(e) => scrollToTopWithOffset(e, "/")}
            className="flex items-center space-x-3 text-xl font-bold text-gradient hover:scale-105 transition-transform"
          >
            <img
              src={Logo}
              alt="Logo"
              className="w-15 h-15 rounded-lg object-cover"
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-8">
            {navigation.map((item) =>
              item.dropdown ? (
                <DropdownMenu
                  open={isDropdownOpen}
                  onOpenChange={setIsDropdownOpen}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive(item.href)
                          ? "text-primary bg-primary/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      }`}
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    sideOffset={8}
                    className="min-w-[150px] "
                  >
                    {partnerItems.map((sub) => (
                      <DropdownMenuItem asChild key={sub.name}>
                        <Link
                          to={sub.href}
                          onClick={(e) => {
                            scrollToTopWithOffset(e, sub.href);
                            setIsDropdownOpen(false); // CLOSE DROPDOWN
                          }}
                          className="flex items-center gap-2"
                        >
                          <sub.icon className="w-4 h-4" />
                          <span>{sub.name}</span>
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={(e) => scrollToTopWithOffset(e, item.href)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              )
            )}
          </div>

          {/* Auth Buttons */}
          <div className="hidden lg:flex items-center space-x-3">
            {/* <Button variant="ghost" size="sm" asChild>
              <Link
                to="/login"
                onClick={(e) => scrollToTopWithOffset(e, "/login")}
                className="flex items-center space-x-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Login</span>
              </Link>
            </Button> */}
            <Button size="sm" asChild className="bg-gradient-hero border-0">
              <Link
                to="/login"
                onClick={(e) => scrollToTopWithOffset(e, "/login")}
                className="flex items-center space-x-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="lg:hidden py-4 border-t border-border/50">
            <div className="space-y-2">
              {navigation.map((item) =>
                item.dropdown ? (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center px-3 py-3 font-medium text-muted-foreground">
                      <item.icon className="w-5 h-5 mr-2" />
                      {item.name}
                    </div>
                    {partnerItems.map((sub) => (
                      <Link
                        key={sub.name}
                        to={sub.href}
                        onClick={(e) => scrollToTopWithOffset(e, sub.href)}
                        className="flex items-center space-x-3 pl-10 pr-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      >
                        <sub.icon className="w-4 h-4" />
                        <span>{sub.name}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={(e) => scrollToTopWithOffset(e, item.href)}
                    className={`flex items-center space-x-3 px-3 py-3 rounded-md text-base font-medium transition-colors ${
                      isActive(item.href)
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                )
              )}
              {/* Auth Buttons in Mobile */}
              <div className="pt-4 space-y-2">
                {/* <Button
                  variant="ghost"
                  className="w-full justify-start"
                  asChild
                >
                  <Link
                    to="/login"
                    onClick={(e) => scrollToTopWithOffset(e, "/login")}
                    className="flex items-center space-x-3"
                  >
                    <LogIn className="w-5 h-5" />
                    <span>Signin</span>
                  </Link>
                </Button> */}
                <Button
                  className="w-full justify-start bg-gradient-hero border-0"
                  asChild
                >
                  <Link
                    to="/login"
                    onClick={(e) => scrollToTopWithOffset(e, "/signup")}
                    className="flex items-center space-x-3"
                  >
                    <UserPlus className="w-5 h-5" />
                    <span>Signin</span>
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
