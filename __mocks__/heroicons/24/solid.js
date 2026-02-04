import * as React from 'react';

const toTestId = (value) =>
  String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();

const iconFactory = (name) => (props = {}) => {
  const testId = props['data-testid'] ?? toTestId(name);
  return React.createElement('svg', { ...props, 'data-icon': name, 'data-testid': testId });
};

export const ArrowUpRightIcon = iconFactory('ArrowUpRightIcon');
export const ArrowUturnLeftIcon = iconFactory('ArrowUturnLeftIcon');
export const ArrowsUpDownIcon = iconFactory('ArrowsUpDownIcon');
export const BookmarkIcon = iconFactory('BookmarkIcon');
export const CalculatorIcon = iconFactory('CalculatorIcon');
export const CalendarDaysIcon = iconFactory('CalendarDaysIcon');
export const ChartBarIcon = iconFactory('ChartBarIcon');
export const ChatBubbleLeftIcon = iconFactory('ChatBubbleLeftIcon');
export const ChatBubbleLeftRightIcon = iconFactory('ChatBubbleLeftRightIcon');
export const ChatBubbleOvalLeftEllipsisIcon = iconFactory('ChatBubbleOvalLeftEllipsisIcon');
export const CheckCircleIcon = iconFactory('CheckCircleIcon');
export const CheckIcon = iconFactory('CheckIcon');
export const ChevronDownIcon = iconFactory('ChevronDownIcon');
export const ChevronUpIcon = iconFactory('ChevronUpIcon');
export const ClipboardDocumentCheckIcon = iconFactory('ClipboardDocumentCheckIcon');
export const ClockIcon = iconFactory('ClockIcon');
export const CreditCardIcon = iconFactory('CreditCardIcon');
export const EyeIcon = iconFactory('EyeIcon');
export const FireIcon = iconFactory('FireIcon');
export const HeartIcon = iconFactory('HeartIcon');
export const HomeIcon = iconFactory('HomeIcon');
export const InformationCircleIcon = iconFactory('InformationCircleIcon');
export const LightBulbIcon = iconFactory('LightBulbIcon');
export const LinkIcon = iconFactory('LinkIcon');
export const MagnifyingGlassCircleIcon = iconFactory('MagnifyingGlassCircleIcon');
export const MagnifyingGlassIcon = iconFactory('MagnifyingGlassIcon');
export const MegaphoneIcon = iconFactory('MegaphoneIcon');
export const NoSymbolIcon = iconFactory('NoSymbolIcon');
export const PencilSquareIcon = iconFactory('PencilSquareIcon');
export const PlayCircleIcon = iconFactory('PlayCircleIcon');
export const PresentationChartLineIcon = iconFactory('PresentationChartLineIcon');
export const RectangleGroupIcon = iconFactory('RectangleGroupIcon');
export const ShareIcon = iconFactory('ShareIcon');
export const SparklesIcon = iconFactory('SparklesIcon');
export const UserGroupIcon = iconFactory('UserGroupIcon');
export const XCircleIcon = iconFactory('XCircleIcon');
export const XMarkIcon = iconFactory('XMarkIcon');

const icons = {
  ArrowUpRightIcon,
  ArrowUturnLeftIcon,
  ArrowsUpDownIcon,
  BookmarkIcon,
  CalculatorIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ChatBubbleLeftIcon,
  ChatBubbleLeftRightIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  CreditCardIcon,
  EyeIcon,
  FireIcon,
  HeartIcon,
  HomeIcon,
  InformationCircleIcon,
  LightBulbIcon,
  LinkIcon,
  MagnifyingGlassCircleIcon,
  MagnifyingGlassIcon,
  MegaphoneIcon,
  NoSymbolIcon,
  PencilSquareIcon,
  PlayCircleIcon,
  PresentationChartLineIcon,
  RectangleGroupIcon,
  ShareIcon,
  SparklesIcon,
  UserGroupIcon,
  XCircleIcon,
  XMarkIcon,
};

export default icons;
