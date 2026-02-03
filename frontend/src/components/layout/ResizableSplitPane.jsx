import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

const ResizableSplitPane = ({
    left,
    right,
    storageKey,
    minLeft = 360,
    maxLeft, // optional
    minRight = 360,
    defaultLeft = 480,
    className = ""
}) => {
    // --- State ---
    const [leftWidth, setLeftWidth] = useState(defaultLeft);
    const [isDragging, setIsDragging] = useState(false);
    const [collapsed, setCollapsed] = useState("none"); // "none" | "left" | "right"

    const containerRef = useRef(null);

    // --- Persistence ---
    useEffect(() => {
        if (!storageKey) return;
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.width) setLeftWidth(parsed.width);
                if (parsed.collapsed) setCollapsed(parsed.collapsed);
            }
        } catch (e) {
            console.error("Failed to load split pane state", e);
        }
    }, [storageKey]);

    useEffect(() => {
        if (!storageKey) return;
        localStorage.setItem(storageKey, JSON.stringify({ width: leftWidth, collapsed }));
    }, [leftWidth, collapsed, storageKey]);

    // --- Resize Handler ---
    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none'; // Prevent text selection
    }, []);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, []);

    const handleMouseMove = useCallback((e) => {
        if (!isDragging || !containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const containerWidth = containerRect.width;

        // Calculate new width relative to container left
        let newLeftWidth = e.clientX - containerRect.left;

        // Constraints
        const actualMaxLeft = maxLeft || (containerWidth - minRight);

        if (newLeftWidth < minLeft) newLeftWidth = minLeft;
        if (newLeftWidth > actualMaxLeft) newLeftWidth = actualMaxLeft;

        setLeftWidth(newLeftWidth);
        // Auto-expand if dragging out of collapse? (Optional, staying simple for now)
    }, [isDragging, minLeft, maxLeft, minRight]);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);


    // --- Render Logic ---

    // Mobile check: The parent (Page) usually handles mobile view switching (showing one or the other).
    // This component is purely for the Desktop Split behavior.
    // We attach `hidden md:flex` to the container to ensure it engages only on desktop,
    // BUT the children might need to be rendered differently on mobile.
    // Actually, per requirement: "Mobile behavior... Do NOT show split... Show list first."
    // The pages (Complaints/Notices) currently have logic like `isMobileDetailsOpen ? 'hidden md:flex' : 'flex'`.
    // We need to integrate that. The most robust way is to let the Page handle the Mobile/Desktop switch logic
    // and only render THIS component when effectively in Desktop mode (or let this component handle the structure).
    // 
    // Given the requirement "Replacement current 2-column layout with <ResizableSplitPane>",
    // we should assume this component REPLACES the `md:flex` area.

    const getLayoutStyles = () => {
        if (collapsed === 'left') {
            return {
                left: { display: 'none' },
                right: { flex: 1, width: '100%' },
                divider: { left: 0 }
            };
        }
        if (collapsed === 'right') {
            return {
                left: { flex: 1, width: '100%' },
                right: { display: 'none' },
                divider: { right: 0 }
            };
        }
        return {
            left: { width: leftWidth, minWidth: minLeft }, // flex-none handled by class
            right: { flex: 1, minWidth: minRight }, // takes remaining
            divider: {}
        };
    };

    const styles = getLayoutStyles();

    return (
        <div
            ref={containerRef}
            className={`h-full w-full flex overflow-hidden ${className}`}
            data-testid="resizable-split-pane"
        >
            {/* LEFT PANE */}
            <div
                className={`flex flex-col overflow-hidden transition-all duration-75 ${collapsed === 'right' ? 'flex-1' : 'flex-none'}`}
                style={styles.left}
            >
                {left}
            </div>

            {/* DIVIDER */}
            <div
                className={`
          relative w-4 -ml-2 z-20 flex items-center justify-center 
          hover:bg-blue-500/10 group cursor-col-resize select-none
          ${isDragging ? 'bg-blue-500/20' : ''}
        `}
                style={{ width: '16px', margin: '0 -8px', zIndex: 50 }} // Larger hit area, visual line centered
                onMouseDown={handleMouseDown}
            >
                {/* Visual Line */}
                <div className={`w-px h-full bg-slate-200 group-hover:bg-blue-400 transition-colors ${isDragging ? 'bg-blue-500' : ''}`} />

                {/* Drag Handle Icon (visible on hover) */}
                {!collapsed && (
                    <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-8 bg-white border shadow-sm rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${isDragging ? 'opacity-100' : ''}`}>
                        <GripVertical className="w-3 h-3 text-slate-400" />
                    </div>
                )}

                {/* Collapse Controls (Only visible on hover or if collapsed) */}
                <div className={`
            absolute top-4 left-1/2 -translate-x-1/2 flex flex-col gap-1 
            opacity-0 group-hover:opacity-100 transition-opacity delay-75
            ${collapsed !== 'none' ? 'opacity-100' : ''}
        `}>
                    {/* RESET */}
                    {collapsed !== 'none' && (
                        <Button
                            variant="secondary" size="icon" className="h-6 w-6 rounded-full shadow border"
                            onClick={(e) => { e.stopPropagation(); setCollapsed('none'); }}
                            title="Restore Split"
                        >
                            <RotateCcw className="w-3 h-3" />
                        </Button>
                    )}

                    {/* COLLAPSE LEFT */}
                    {collapsed === 'none' && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost" size="icon" className="h-5 w-5 bg-white border shadow-sm rounded-full hover:bg-slate-50"
                                        onClick={(e) => { e.stopPropagation(); setCollapsed('left'); }}
                                    >
                                        <ChevronLeft className="w-3 h-3 text-slate-500" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left"><p>Collapse List</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}

                    {/* COLLAPSE RIGHT */}
                    {collapsed === 'none' && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost" size="icon" className="h-5 w-5 bg-white border shadow-sm rounded-full hover:bg-slate-50"
                                        onClick={(e) => { e.stopPropagation(); setCollapsed('right'); }}
                                    >
                                        <ChevronRight className="w-3 h-3 text-slate-500" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right"><p>Collapse Details</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            </div>

            {/* RIGHT PANE */}
            <div
                className={`flex flex-col min-w-0 overflow-hidden transition-all duration-75 ${collapsed === 'left' ? 'flex-1' : ''}`}
                style={styles.right}
            >
                {right}
            </div>
        </div>
    );
};

export default ResizableSplitPane;
