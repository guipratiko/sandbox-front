import React, { ReactNode, useEffect, useState, useRef } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string | ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  headerActions?: ReactNode;
  draggable?: boolean;
  initialPosition?: { x: number; y: number };
  modalId?: string;
  zIndex?: number;
}

const sizeClasses = {
  sm: 'w-[calc(100vw-2rem)] sm:max-w-md',
  md: 'w-[calc(100vw-2rem)] sm:max-w-lg',
  lg: 'w-[calc(100vw-2rem)] sm:max-w-2xl min-w-[min(20rem,100vw-2rem)]',
  xl: 'w-[calc(100vw-2rem)] sm:max-w-4xl min-w-[min(24rem,100vw-2rem)]',
  full: 'w-[calc(100vw-2rem)] max-w-full',
};

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  headerActions,
  draggable = false,
  initialPosition,
  modalId,
  zIndex = 50,
}) => {
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (initialPosition) return initialPosition;
    // Posição padrão centralizada
    return { x: 0, y: 0 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // Restaurar posição do localStorage se existir
  useEffect(() => {
    if (draggable && modalId && isOpen) {
      const savedPosition = localStorage.getItem(`modal_position_${modalId}`);
      if (savedPosition) {
        try {
          const pos = JSON.parse(savedPosition);
          setPosition(pos);
        } catch (e) {
          // Ignorar erro de parse
        }
      } else if (initialPosition) {
        setPosition(initialPosition);
      }
    }
  }, [draggable, modalId, isOpen, initialPosition]);

  // Salvar posição no localStorage
  useEffect(() => {
    if (draggable && modalId && isOpen && position.x !== 0 && position.y !== 0) {
      localStorage.setItem(`modal_position_${modalId}`, JSON.stringify(position));
    }
  }, [position, draggable, modalId, isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      if (!draggable) {
        document.body.style.overflow = 'hidden';
      }
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      if (!draggable) {
        document.body.style.overflow = 'unset';
      }
    };
  }, [isOpen, onClose, draggable]);

  // Handlers de drag otimizados
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!draggable || !modalRef.current || !headerRef.current) return;
    
    // Prevenir seleção de texto durante o drag
    e.preventDefault();
    e.stopPropagation();
    
    const rect = modalRef.current.getBoundingClientRect();
    // Calcular offset relativo à posição atual do modal
    // Usar getBoundingClientRect() que já considera o transform
    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) {
      // Cancelar qualquer animação pendente
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    let lastX = position.x;
    let lastY = position.y;

    const handleMouseMove = (e: MouseEvent) => {
      if (!modalRef.current) return;
      
      // Cancelar frame anterior se existir
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Usar requestAnimationFrame para suavizar o movimento
      animationFrameRef.current = requestAnimationFrame(() => {
        if (!modalRef.current) return;
        
        const maxX = window.innerWidth - modalRef.current.offsetWidth;
        const maxY = window.innerHeight - modalRef.current.offsetHeight;
        
        // Calcular nova posição baseada no mouse
        let newX = e.clientX - dragOffsetRef.current.x;
        let newY = e.clientY - dragOffsetRef.current.y;
        
        // Limitar dentro da viewport
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));
        
        // Só atualizar se a posição mudou (evita re-renders desnecessários)
        if (newX !== lastX || newY !== lastY) {
          lastX = newX;
          lastY = newY;
          setPosition({ x: newX, y: newY });
        }
      });
    };

    const handleMouseUp = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setIsDragging(false);
    };

    // Usar passive: false para permitir preventDefault se necessário
    document.addEventListener('mousemove', handleMouseMove, { passive: false });
    document.addEventListener('mouseup', handleMouseUp);
    
    // Prevenir seleção de texto durante o drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isDragging, position.x, position.y]);

  if (!isOpen) return null;

  const modalStyle: React.CSSProperties = draggable
    ? {
        position: 'fixed',
        left: 0,
        top: 0,
        // Usar transform para GPU acceleration (melhor performance)
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        margin: 0,
        // Otimizações de performance
        willChange: isDragging ? 'transform' : 'auto',
        backfaceVisibility: 'hidden',
        perspective: 1000,
        // Transições suaves quando não está arrastando
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease, transform 0.1s ease-out',
        // Feedback visual durante o drag
        boxShadow: isDragging 
          ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 0, 0, 0.1)' 
          : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        // Melhorar responsividade visual
        opacity: isDragging ? 0.95 : 1,
      }
    : {};

  return (
    <div
      className={`fixed inset-0 ${draggable ? 'pointer-events-none' : 'flex items-center justify-center p-4'} animate-fadeIn bg-black/30 backdrop-blur-[2px] sm:backdrop-blur-sm`}
      style={{ zIndex }}
      onClick={draggable ? undefined : onClose}
    >
      <div
        ref={modalRef}
        className={`bg-white dark:bg-[#091D41] rounded-2xl shadow-2xl ring-1 ring-black/5 dark:ring-white/5 ${draggable ? 'min-h-[12rem] min-w-[18rem] sm:min-w-[20rem]' : 'w-full'} ${sizeClasses[size]} max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col transition-all duration-200 ${draggable ? 'pointer-events-auto' : 'animate-slideIn'}`}
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showCloseButton || headerActions) && (
          <div
            ref={headerRef}
            className={`flex items-center justify-between p-4 sm:p-5 border-b border-gray-200/80 dark:border-gray-700/80 ${
              draggable 
                ? `cursor-move select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} active:cursor-grabbing rounded-t-2xl` 
                : ''
            }`}
            onMouseDown={handleMouseDown}
            style={{
              userSelect: draggable ? 'none' : 'auto',
              WebkitUserSelect: draggable ? 'none' : 'auto',
            }}
          >
            <div className="flex-1 min-w-0">
              {title && (
                typeof title === 'string' ? (
                  <h2 className="text-lg sm:text-xl font-semibold text-clerky-backendText dark:text-gray-200 truncate">
                    {title}
                  </h2>
                ) : (
                  title
                )
              )}
            </div>
            <div className="flex items-center gap-1 sm:gap-2 ml-3 sm:ml-4 shrink-0">
              {headerActions}
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-200"
                  aria-label="Fechar"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 overscroll-contain">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
