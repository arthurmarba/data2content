import React from "react";

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  padding?: string;
}

const Container: React.FC<ContainerProps> = ({ children, className = "", padding = "" }) => {
  return <div className={`max-w-screen-xl mx-auto px-6 ${padding} ${className}`}>{children}</div>;
};

export default Container;

