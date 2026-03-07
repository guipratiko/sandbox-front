/**
 * Componente para renderizar HTML de forma segura
 * Sanitiza o conteúdo antes de renderizar para prevenir XSS
 */

import React from 'react';
import { sanitizeHTML } from '../../utils/sanitize';

interface SafeHTMLProps {
  content: string;
  className?: string;
  tag?: keyof JSX.IntrinsicElements;
}

const SafeHTML: React.FC<SafeHTMLProps> = ({ 
  content, 
  className = '', 
  tag: Tag = 'div' 
}) => {
  const sanitized = sanitizeHTML(content);
  
  return (
    <Tag 
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
};

export default SafeHTML;
